package main

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type JWKS struct {
	Keys []JWK `json:"keys"`
}

type CognitoJWTClaims struct {
	jwt.RegisteredClaims
	TokenUse string `json:"token_use"`
	Username string `json:"username"`
	CognitoUsername string `json:"cognito:username"`
	Email    string `json:"email"`
	GivenName string `json:"given_name"`
	FamilyName string `json:"family_name"`
}

var (
	jwksCache     *JWKS
	jwksCacheTime time.Time
	jwksCacheTTL  = 24 * time.Hour
)

func getJWKSFromCognito(region, userPoolId string) (*JWKS, error) {
	if jwksCache != nil && time.Since(jwksCacheTime) < jwksCacheTTL {
		return jwksCache, nil
	}

	jwksURL := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json", region, userPoolId)
	
	resp, err := http.Get(jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch JWKS: HTTP %d", resp.StatusCode)
	}

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %w", err)
	}

	jwksCache = &jwks
	jwksCacheTime = time.Now()
	return &jwks, nil
}

func getPublicKeyFromJWK(jwk *JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(jwk.N)
	if err != nil {
		return nil, fmt.Errorf("failed to decode N: %w", err)
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(jwk.E)
	if err != nil {
		return nil, fmt.Errorf("failed to decode E: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}

func validateJWTToken(tokenString, region, userPoolId string) (*CognitoJWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CognitoJWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, errors.New("kid header missing")
		}

		jwks, err := getJWKSFromCognito(region, userPoolId)
		if err != nil {
			return nil, err
		}

		for _, jwk := range jwks.Keys {
			if jwk.Kid == kid {
				return getPublicKeyFromJWK(&jwk)
			}
		}

		return nil, errors.New("unable to find appropriate key")
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*CognitoJWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	// Validate token use (should be "access" for API access)
	if claims.TokenUse != "access" {
		return nil, errors.New("invalid token use")
	}

	// Validate issuer
	expectedIssuer := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s", region, userPoolId)
	if claims.Issuer != expectedIssuer {
		return nil, errors.New("invalid issuer")
	}

	return claims, nil
}

func extractUserIDFromJWT(tokenString, region, userPoolId string) (string, error) {
	claims, err := validateJWTToken(tokenString, region, userPoolId)
	if err != nil {
		return "", err
	}

	// Use cognito:username if available, otherwise fall back to username
	if claims.CognitoUsername != "" {
		return claims.CognitoUsername, nil
	}
	
	if claims.Username != "" {
		return claims.Username, nil
	}

	return "", errors.New("no username found in token")
}

func extractBearerToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.New("authorization header missing")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", errors.New("invalid authorization header format")
	}

	return parts[1], nil
}