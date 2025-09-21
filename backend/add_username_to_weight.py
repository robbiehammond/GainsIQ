#!/usr/bin/env python3
"""
Add a username attribute set to "hammero" for every item in a DynamoDB Weight table.

Usage:
  python add_username_to_weight.py <table-name-or-arn> [--region <aws-region>] [--profile <aws-profile>] [--dry-run] [--only-if-missing]

Examples:
  python add_username_to_weight.py Weight --region us-east-1
  python add_username_to_weight.py arn:aws:dynamodb:us-east-1:111122223333:table/Weight --profile myprof --only-if-missing

Notes:
  - Auto-detects key schema (weight table often uses timestamp as the PK).
  - By default, unconditionally sets username="hammero". Use --only-if-missing to add it only when absent.
"""

import argparse
import sys
import time
from typing import Dict, List, Tuple

import boto3
from botocore.exceptions import ClientError


def normalize_table_name(table_or_arn: str) -> str:
    if table_or_arn.startswith("arn:") and ":table/" in table_or_arn:
        return table_or_arn.split(":table/")[-1].split("/")[0]
    return table_or_arn


def get_key_schema(client, table_name: str) -> List[Tuple[str, str]]:
    desc = client.describe_table(TableName=table_name)["Table"]
    key_schema = desc.get("KeySchema", [])
    attr_defs = {a["AttributeName"]: a["AttributeType"] for a in desc.get("AttributeDefinitions", [])}
    out: List[Tuple[str, str]] = []
    for ks in key_schema:
        name = ks["AttributeName"]
        a_type = attr_defs.get(name, "S")
        out.append((name, a_type))
    return out


def key_from_item(item: Dict, key_schema: List[Tuple[str, str]]) -> Dict:
    key = {}
    for name, _ in key_schema:
        av = item.get(name)
        if av is None:
            raise ValueError(f"Item missing key attribute '{name}': {item}")
        key[name] = av
    return key


def scan_items(client, table_name: str, projection_names: List[str]):
    expr_names = {f"#n{i}": n for i, n in enumerate(projection_names)}
    projection_expr = ", ".join(expr_names.keys())

    paginator = client.get_paginator("scan")
    for page in paginator.paginate(
        TableName=table_name,
        ProjectionExpression=projection_expr,
        ExpressionAttributeNames=expr_names,
    ):
        for item in page.get("Items", []):
            yield item


def update_username(client, table_name: str, key: Dict, username_value: str, only_if_missing: bool, retries: int = 5):
    attempt = 0
    backoff = 0.5
    while True:
        try:
            kwargs = dict(
                TableName=table_name,
                Key=key,
                UpdateExpression="SET #u = :u",
                ExpressionAttributeNames={"#u": "username"},
                ExpressionAttributeValues={":u": {"S": username_value}},
                ReturnValues="NONE",
            )
            if only_if_missing:
                kwargs["ConditionExpression"] = "attribute_not_exists(#u)"

            client.update_item(**kwargs)
            return True
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("ProvisionedThroughputExceededException", "ThrottlingException") and attempt < retries:
                time.sleep(backoff)
                backoff *= 2
                attempt += 1
                continue
            if code == "ConditionalCheckFailedException" and only_if_missing:
                # username already exists; treat as no-op success
                return False
            raise


def main():
    parser = argparse.ArgumentParser(description="Append username='hammero' to all items in a DynamoDB Weight table.")
    parser.add_argument("table", help="DynamoDB table name or ARN")
    parser.add_argument("--region", help="AWS region (e.g., us-east-1)")
    parser.add_argument("--profile", help="AWS profile name")
    parser.add_argument("--dry-run", action="store_true", help="Scan only; do not write updates")
    parser.add_argument("--only-if-missing", action="store_true", help="Only add username if it does not exist")
    args = parser.parse_args()

    table_name = normalize_table_name(args.table)

    if args.profile:
        boto3.setup_default_session(profile_name=args.profile, region_name=args.region)
        session = boto3.Session(profile_name=args.profile, region_name=args.region)
    else:
        session = boto3.Session(region_name=args.region)
    client = session.client("dynamodb")

    try:
        key_schema = get_key_schema(client, table_name)
    except ClientError as e:
        print(f"Error describing table '{table_name}': {e}", file=sys.stderr)
        sys.exit(1)

    key_names = [k for k, _ in key_schema]
    projection = key_names + ["username"]

    total = 0
    modified = 0

    print(f"Scanning table: {table_name}")
    print(f"Key schema: {', '.join(key_names)}")
    for item in scan_items(client, table_name, projection):
        total += 1
        try:
            key = key_from_item(item, key_schema)
        except ValueError as ve:
            print(f"Skipping item missing key(s): {ve}", file=sys.stderr)
            continue

        if args.dry_run:
            existing_user = item.get("username", {})
            action = "add" if not existing_user else ("skip" if args.only_if_missing else "overwrite")
            print(f"Would {action}: key={key}, existing username={existing_user}")
            continue

        changed = update_username(client, table_name, key, "hammero", args.only_if_missing)
        if changed:
            modified += 1
            if modified % 25 == 0:
                print(f"Updated {modified} items...")

    if args.dry_run:
        print(f"Dry run complete. Items scanned: {total}. No updates written.")
    else:
        print(f"Done. Items scanned: {total}. Items updated: {modified}.")


if __name__ == "__main__":
    main()

