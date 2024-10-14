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
from constructs import Construct
from aws_cdk.aws_apigateway import Cors

class GainsIQStack(Stack):

    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        openai_key_file = './openai_key.txt'
        
        if not os.path.exists(openai_key_file):
            raise FileNotFoundError(f"{openai_key_file} does not exist. Please make sure the file exists.")
        
        with open(openai_key_file, 'r') as f:
            openai_api_key = f.read().strip()

        frontend_bucket = s3.Bucket(self, "GainsIQFrontend",
                                    website_index_document="index.html",
                                    public_read_access=True,
                                    block_public_access=s3.BlockPublicAccess.BLOCK_ACLS)

        s3deploy.BucketDeployment(self, "DeployWebsite",
                                  sources=[s3deploy.Source.asset("./frontend/build")],
                                  destination_bucket=frontend_bucket)

        exercises_table = dynamodb.Table(self, "ExercisesTable",
                                         partition_key=dynamodb.Attribute(
                                             name="exerciseName", type=dynamodb.AttributeType.STRING),
                                         billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)

        sets_table = dynamodb.Table(self, "SetsTable",
                                    partition_key=dynamodb.Attribute(
                                        name="workoutId", type=dynamodb.AttributeType.STRING),
                                    sort_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                    point_in_time_recovery=True
                                    )

        data_bucket = s3.Bucket(self, "GainsIQDataBucket",
                                versioned=True)

        lambda_role = iam.Role(self, "GainsIQLambdaRole",
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
            resources=[exercises_table.table_arn, sets_table.table_arn]
        ))

        data_bucket.grant_read_write(lambda_role)

        notification_topic = sns.Topic(self, "GainsIQNotifications")

        notification_topic.add_subscription(subs.EmailSubscription("robbiehammond3@gmail.com"))

        backend_lambda = _lambda.Function(self, "GainsIQBackendHandler",
                                          runtime=_lambda.Runtime.PYTHON_3_9,
                                          handler="backend.main",
                                          code=_lambda.Code.from_asset("lambda"),
                                          role=lambda_role,
                                          environment={
                                              'EXERCISES_TABLE': exercises_table.table_name,
                                              'SETS_TABLE': sets_table.table_name
                                          })

        processing_lambda = _lambda.Function(self, "GainsIQProcessingLambda",
                                             runtime=_lambda.Runtime.PYTHON_3_9,
                                             handler="processing_lambda.lambda_handler",
                                             code=_lambda.Code.from_asset("lambda"),
                                             role=lambda_role,
                                             timeout=Duration.minutes(5),
                                             environment={
                                                 'SETS_TABLE': sets_table.table_name,
                                                 'EXERCISES_TABLE': exercises_table.table_name,
                                                 'S3_BUCKET_NAME': data_bucket.bucket_name,
                                                 'OPENAI_API_KEY': openai_api_key,  
                                                 'SNS_TOPIC_ARN': notification_topic.topic_arn 
                                             })
        
        rust_backend_lambda = _lambda.Function(self, "GainsIQRustBackendHandler",
                                               runtime=_lambda.Runtime.PROVIDED_AL2,  # AWS-provided AL2 runtime for custom runtimes like Rust
                                               handler="bootstrap",  # This is the handler for Rust Lambda
                                               code=_lambda.Code.from_asset("./backend_rs/target/lambda/backend_rs"),  # Adjust path to compiled Rust lambda
                                               role=lambda_role,
                                               timeout=Duration.minutes(5),
                                               environment={
                                                   'EXERCISES_TABLE': exercises_table.table_name,
                                                   'SETS_TABLE': sets_table.table_name
                                               })

        # Grant the processing Lambda permission to publish to the SNS topic
        notification_topic.grant_publish(processing_lambda)

        # API Gateway for the workout tracker (Backend Lambda)
        api = apigateway.RestApi(self, "GainsIQAPI",
                                 rest_api_name="GainsIQ API",
                                 description="API for GainsIQ workout tracker.",
                                 default_cors_preflight_options={
                                     "allow_origins": Cors.ALL_ORIGINS,
                                     "allow_methods": Cors.ALL_METHODS
                                 })

        workouts = api.root.add_resource("workouts")
        workouts.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        workouts.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        monthly_rule = events.Rule(self, "GainsIQMonthlyRule",
                                   schedule=events.Schedule.cron(minute="0", hour="0", day="1", month="*", year="*"))

        monthly_rule.add_target(targets.LambdaFunction(processing_lambda))