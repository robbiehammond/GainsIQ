from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_s3_deployment as s3deploy,
    aws_sns as sns,
    aws_sns_subscriptions as subs,
    aws_events as events,
    aws_events_targets as targets,
    aws_iam as iam,
    Duration
)
import os
import json
from constructs import Construct
from aws_cdk.aws_apigateway import Cors

class GainsIQStack(Stack):

    def __init__(self, scope: Construct, id: str, *, env_name: str = "prod", **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        with open('config.json') as config_file:
            config = json.load(config_file)
            email = config.get('email')
            openai_key = config.get('openai_key')
        
        if not email:
            raise ValueError("email not set in config file")
        
        if not openai_key:
            raise ValueError("openai_key not set in config file.")

        # Append '-preprod' to names if we're in preprod
        suffix = "-preprod" if env_name == "preprod" else ""

        frontend_bucket = s3.Bucket(self, f"GainsIQFrontend{suffix}",
                                    website_index_document="index.html",
                                    public_read_access=True,
                                    block_public_access=s3.BlockPublicAccess.BLOCK_ACLS)

        s3deploy.BucketDeployment(self, f"DeployWebsite{suffix}",
                                  sources=[s3deploy.Source.asset("./frontend/build")],
                                  destination_bucket=frontend_bucket)

        exercises_table = dynamodb.Table(self, f"ExercisesTable{suffix}",
                                         partition_key=dynamodb.Attribute(
                                             name="exerciseName", type=dynamodb.AttributeType.STRING),
                                         billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)

        sets_table = dynamodb.Table(self, f"SetsTable{suffix}",
                                    partition_key=dynamodb.Attribute(
                                        name="workoutId", type=dynamodb.AttributeType.STRING),
                                    sort_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                    point_in_time_recovery=True
                                    )
        
        weight_table = dynamodb.Table(self, f"WeightTable{suffix}",
                                    partition_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                    point_in_time_recovery=True
                                    )

        data_bucket = s3.Bucket(self, f"GainsIQDataBucket{suffix}",
                                versioned=True)

        # IAM Role
        lambda_role = iam.Role(self, f"GainsIQLambdaRole{suffix}",
                               assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
                               managed_policies=[
                                   iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
                               ])

        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            resources=[exercises_table.table_arn, sets_table.table_arn, weight_table.table_arn]
        ))

        data_bucket.grant_read_write(lambda_role)

        notification_topic = sns.Topic(self, f"GainsIQNotifications{suffix}")

        notification_topic.add_subscription(subs.EmailSubscription(email))

        processing_lambda = _lambda.Function(self, f"GainsIQProcessingLambda{suffix}",
                                             runtime=_lambda.Runtime.PYTHON_3_9,
                                             handler="processing_lambda.lambda_handler",
                                             code=_lambda.Code.from_asset("backend/summary_maker"),
                                             role=lambda_role,
                                             timeout=Duration.minutes(5),
                                             environment={
                                                 'SETS_TABLE': sets_table.table_name,
                                                 'EXERCISES_TABLE': exercises_table.table_name,
                                                 'S3_BUCKET_NAME': data_bucket.bucket_name,
                                                 'OPENAI_API_KEY': openai_key,  
                                                 'SNS_TOPIC_ARN': notification_topic.topic_arn 
                                             })
        
        backend_lambda = _lambda.Function(self, f"GainsIQRustBackendHandler{suffix}",
                                               runtime=_lambda.Runtime.PROVIDED_AL2023,  
                                               handler="bootstrap", 
                                               architecture=_lambda.Architecture.ARM_64,
                                               code=_lambda.Code.from_asset("./backend/target/lambda/backend_rs"),
                                               role=lambda_role,
                                               timeout=Duration.minutes(5),
                                               environment={
                                                   'EXERCISES_TABLE': exercises_table.table_name,
                                                   'SETS_TABLE': sets_table.table_name,
                                                   'WEIGHT_TABLE': weight_table.table_name
                                               })

        notification_topic.grant_publish(processing_lambda)

        api = apigateway.RestApi(self, f"GainsIQAPI{suffix}",
                                 rest_api_name=f"GainsIQ API {env_name}",
                                 description=f"API for GainsIQ workout tracker ({env_name}).",
                                 default_cors_preflight_options={
                                     "allow_origins": Cors.ALL_ORIGINS,
                                     "allow_methods": Cors.ALL_METHODS
                                 })

        exercises = api.root.add_resource("exercises")
        exercises.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        exercises.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        sets = api.root.add_resource("sets")
        log = sets.add_resource("log")
        log.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        pop_set = sets.add_resource("pop")
        pop_set.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        last_month = sets.add_resource("last_month")
        last_month.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        weight = api.root.add_resource("weight")
        weight.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        weight.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        weight.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        monthly_rule = events.Rule(self, f"GainsIQMonthlyRule{suffix}",
                                   schedule=events.Schedule.cron(minute="0", hour="0", day="1", month="*", year="*"))

        monthly_rule.add_target(targets.LambdaFunction(processing_lambda))