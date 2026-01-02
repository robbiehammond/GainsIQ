from aws_cdk import (
    BundlingOptions,
    Stack,
    RemovalPolicy,
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
    aws_sqs as sqs,
    aws_lambda_event_sources as lambda_event_sources,
    Duration,
    aws_logs as logs,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_stepfunctions as sfn,
    aws_stepfunctions_tasks as tasks,
    CfnOutput
)
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
            oura_api_key = config.get('oura_key')

        
        if not email:
            raise ValueError("email not set in config file")
        
        if not openai_key:
            raise ValueError("openai_key not set in config file.")
        
        if not oura_api_key:
            raise ValueError("oura_key not set in config file.")


        is_preprod = env_name == "preprod"

        # Append '-preprod' to names if we're in preprod
        suffix = "-preprod" if is_preprod else ""


        exercises_table = dynamodb.Table(self, f"ExercisesTable{suffix}",
                                         partition_key=dynamodb.Attribute(
                                             name="exerciseName", type=dynamodb.AttributeType.STRING),
                                         billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)
        
        # Add GSI for user-based exercise queries (original - keep for existing data)
        exercises_table.add_global_secondary_index(
            index_name="UserExercisesIndex",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="exerciseName", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL
        )

        # Add new GSI for username-based exercise queries
        exercises_table.add_global_secondary_index(
            index_name="UsernameExercisesIndex",
            partition_key=dynamodb.Attribute(name="username", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="exerciseName", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL
        )

        sets_table = dynamodb.Table(self, f"SetsTable{suffix}",
                                    partition_key=dynamodb.Attribute(
                                        name="workoutId", type=dynamodb.AttributeType.STRING),
                                    sort_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                    point_in_time_recovery=True
                                    )
        
        # Add GSI for user-based set queries
        sets_table.add_global_secondary_index(
            index_name="UserSetsIndex",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="timestamp", type=dynamodb.AttributeType.NUMBER),
            projection_type=dynamodb.ProjectionType.ALL
        )
        
        weight_table = dynamodb.Table(self, f"WeightTable{suffix}",
                                    partition_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                    point_in_time_recovery=True
                                    )
        
        # Add GSI for user-based weight queries
        weight_table.add_global_secondary_index(
            index_name="UserWeightIndex",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="timestamp", type=dynamodb.AttributeType.NUMBER),
            projection_type=dynamodb.ProjectionType.ALL
        )
        
        analyses_table = dynamodb.Table(self, f"AnalysesTable{suffix}",
                                        partition_key=dynamodb.Attribute(
                                            name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                        billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST
                                        )

        # Injuries table: timestamp key and username GSI for per-user queries
        injuries_table = dynamodb.Table(self, f"InjuriesTable{suffix}",
                                        partition_key=dynamodb.Attribute(
                                            name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                        billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
                                        point_in_time_recovery=True
                                        )
        injuries_table.add_global_secondary_index(
            index_name="UsernameInjuryIndex",
            partition_key=dynamodb.Attribute(name="username", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="timestamp", type=dynamodb.AttributeType.NUMBER),
            projection_type=dynamodb.ProjectionType.ALL
        )

        # Bodyparts table: per-user locations (username PK, location SK)
        bodyparts_table = dynamodb.Table(self, f"BodypartsTable{suffix}",
                                         partition_key=dynamodb.Attribute(
                                             name="username", type=dynamodb.AttributeType.STRING),
                                         sort_key=dynamodb.Attribute(
                                             name="location", type=dynamodb.AttributeType.STRING),
                                         billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST
                                         )
        
        # Add GSI for user-based analysis queries
        analyses_table.add_global_secondary_index(
            index_name="UserAnalysisIndex",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="timestamp", type=dynamodb.AttributeType.NUMBER),
            projection_type=dynamodb.ProjectionType.ALL
        )

        users_table = dynamodb.Table(self, f"UsersTable{suffix}",
                                    partition_key=dynamodb.Attribute(
                                        name="username", type=dynamodb.AttributeType.STRING),
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


        data_bucket.grant_read_write(lambda_role)

        # Create a new Lambda function with a different name to avoid permission accumulation
        backend_lambda = _lambda.Function(self, f"GainsIQGoBackendHandlerV2{suffix}",
                                                function_name=f"GainsIQGoBackendHandlerV2{suffix}",
                                                runtime=_lambda.Runtime.PROVIDED_AL2023,
                                                handler="main",
                                                code=_lambda.Code.from_asset("./backend/go"),
                                                role=lambda_role,
                                                timeout=Duration.minutes(5),
                                                environment={
                                                    'ANALYSES_TABLE': analyses_table.table_name,
                                                    'EXERCISES_TABLE': exercises_table.table_name,
                                                    'SETS_TABLE': sets_table.table_name,
                                                    'WEIGHT_TABLE': weight_table.table_name,
                                                    'USERS_TABLE': users_table.table_name,
                                                    'INJURIES_TABLE': injuries_table.table_name,
                                                    'BODYPARTS_TABLE': bodyparts_table.table_name
                                                })
        
        log_group = logs.LogGroup(self, f"GainsIQApiLogs{suffix}",
                              retention=logs.RetentionDays.ONE_WEEK)

        # Create RestApi with explicit routes instead of LambdaRestApi to ensure proper routing
        api = apigateway.RestApi(self, f"GainsIQAPI{suffix}",
                         rest_api_name=f"GainsIQ API {env_name}",
                         description=f"API for GainsIQ workout tracker ({env_name}).",
                         deploy_options=apigateway.StageOptions(
                             logging_level=apigateway.MethodLoggingLevel.INFO,
                             data_trace_enabled=True,
                             metrics_enabled=True,
                             access_log_destination=apigateway.LogGroupLogDestination(log_group),
                         ),
                         default_cors_preflight_options={
                             "allow_origins": Cors.ALL_ORIGINS,
                             "allow_methods": Cors.ALL_METHODS
                         },
                         cloud_watch_role=True
                         )

        usage_plan = api.add_usage_plan(f"GainsIQUsagePlan{suffix}",
                                name=f"GainsIQUsagePlan{suffix}",
                                throttle={
                                    "rate_limit": 5,
                                    "burst_limit": 10
                                })

        usage_plan.add_api_stage(
            stage=api.deployment_stage
        )

        # Single ANY proxy to minimize Lambda resource policy size
        any_integration = apigateway.LambdaIntegration(backend_lambda, proxy=True)
        api.root.add_method("ANY", any_integration)
        proxy_resource = api.root.add_resource("{proxy+}")
        proxy_resource.add_method("ANY", any_integration)

        # DEPRECATED
        anomalies_table = dynamodb.Table(self, f"AnomaliesTable{suffix}",
            partition_key=dynamodb.Attribute(
                name="anomalyId",
                type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True
        )

        # Add broad DynamoDB permissions (simplified to keep policy size small)
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
                "dynamodb:DeleteItem",
                "dynamodb:TransactWriteItems"
            ],
            resources=["*"]
        ))

        website_bucket = s3.Bucket(
            self,
            f"GainsIQWebsiteBucket{suffix}",
            website_index_document="index.html",
            website_error_document="index.html",
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ACLS,
            removal_policy=RemovalPolicy.DESTROY if is_preprod else RemovalPolicy.RETAIN,
            auto_delete_objects=is_preprod,
        )

        # Build a small runtime config.json for the frontend with the API base URL
        runtime_config = s3deploy.Source.data(
            "config.json",
            json.dumps({
                "apiBaseUrl": api.url,  # e.g., https://xxxx.execute-api.us-west-2.amazonaws.com/prod/
                "env": env_name,
            })
        )

        s3deploy.BucketDeployment(
            self,
            f"GainsIQWebsiteDeploy{suffix}",
            destination_bucket=website_bucket,
            sources=[
                s3deploy.Source.asset("frontend/dist"),
                runtime_config,
            ],
        )
        CfnOutput(self, f"WebsiteURL{suffix}", value=website_bucket.bucket_website_url)
        CfnOutput(self, f"ApiURL{suffix}", value=api.url)
