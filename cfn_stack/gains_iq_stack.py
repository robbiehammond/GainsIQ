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
    aws_sqs as sqs,
    aws_lambda_event_sources as lambda_event_sources,
    Duration,
    aws_logs as logs
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
            api_keys = config.get('api_keys', {})

        
        if not email:
            raise ValueError("email not set in config file")
        
        if not openai_key:
            raise ValueError("openai_key not set in config file.")
        
        if not oura_api_key:
            raise ValueError("oura_key not set in config file.")

        
        # Convert the API keys map to a JSON string
        api_keys_json = json.dumps(api_keys)

        is_preprod = env_name == "preprod"

        # Append '-preprod' to names if we're in preprod
        suffix = "-preprod" if is_preprod else ""

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
        
        analyses_table = dynamodb.Table(self, f"AnalysesTable{suffix}",
                                        partition_key=dynamodb.Attribute(
                                            name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                        billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST
                                        )

        data_bucket = s3.Bucket(self, f"GainsIQDataBucket{suffix}",
                                versioned=True)

        processing_lambda_trigger_queue = sqs.Queue(
            self, 
            f"ProcessingLambdaTriggerQueue{suffix}",
            queue_name=f"AnalysisRequestsQueue{suffix}",
            visibility_timeout=Duration.seconds(300)
        )

        # IAM Role
        lambda_role = iam.Role(self, f"GainsIQLambdaRole{suffix}",
                               assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
                               managed_policies=[
                                   iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
                               ])

        # Could do at some point: make a specific roles for the API backend and the processing lambda.
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
            resources=[exercises_table.table_arn, sets_table.table_arn, weight_table.table_arn, analyses_table.table_arn]
        ))

        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "sqs:SendMessage",
                "sqs:SendMessageBatch"
            ],
            resources=[processing_lambda_trigger_queue.queue_arn]  
        ))

        data_bucket.grant_read_write(lambda_role)

        processing_lambda = _lambda.Function(self, f"GainsIQProcessingLambda{suffix}",
                                             runtime=_lambda.Runtime.PYTHON_3_9,
                                             handler="processing_lambda.lambda_handler",
                                             code=_lambda.Code.from_asset("backend/aux_lambdas/summary_maker"),
                                             role=lambda_role,
                                             timeout=Duration.minutes(5),
                                             environment={
                                                 'SETS_TABLE': sets_table.table_name,
                                                 'EXERCISES_TABLE': exercises_table.table_name,
                                                 'ANALYSES_TABLE': analyses_table.table_name,
                                                 'S3_BUCKET_NAME': data_bucket.bucket_name,
                                                 'OPENAI_API_KEY': openai_key,  
                                                 'IS_PREPROD': "YES" if is_preprod else "NO"
                                             })

        processing_lambda.add_event_source(
            lambda_event_sources.SqsEventSource(
                processing_lambda_trigger_queue
            )
        )
        
        backend_lambda = _lambda.Function(self, f"GainsIQRustBackendHandler{suffix}",
                                               runtime=_lambda.Runtime.PROVIDED_AL2023,  
                                               handler="bootstrap", 
                                               architecture=_lambda.Architecture.ARM_64,
                                               code=_lambda.Code.from_asset("./backend/target/lambda/backend_rs"),
                                               role=lambda_role,
                                               timeout=Duration.minutes(5),
                                               environment={
                                                   'ANALYSES_TABLE': analyses_table.table_name,
                                                   'EXERCISES_TABLE': exercises_table.table_name,
                                                   'SETS_TABLE': sets_table.table_name,
                                                   'WEIGHT_TABLE': weight_table.table_name,
                                                   'QUEUE_URL': processing_lambda_trigger_queue.queue_url,
                                                   'API_KEY_MAP': api_keys_json,
                                                   'OURA_API_KEY': oura_api_key
                                               })
        
        log_group = logs.LogGroup(self, f"GainsIQApiLogs{suffix}",
                              retention=logs.RetentionDays.ONE_WEEK)
        
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
        

        exercises = api.root.add_resource("exercises")
        exercises.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        exercises.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        exercises.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        sets = api.root.add_resource("sets")
        log = sets.add_resource("log")
        log.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        pop_set = sets.add_resource("pop")
        pop_set.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        sets.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        last_month = sets.add_resource("last_month")
        last_month.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        edit = sets.add_resource("edit")
        edit.add_method("PUT", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        by_exercise = sets.add_resource("by_exercise")
        by_exercise.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        weight = api.root.add_resource("weight")
        weight.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        weight.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        weight.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        analysis = api.root.add_resource("analysis")
        analysis.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        analysis.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        # Endpoint to log a predefined workout to Oura
        oura = api.root.add_resource("oura")
        oura_log = oura.add_resource("log")
        oura_log.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        monthly_rule = events.Rule(self, f"GainsIQMonthlyRule{suffix}",
                                   schedule=events.Schedule.cron(minute="0", hour="0", day="1", month="*", year="*"))

        monthly_rule.add_target(targets.LambdaFunction(processing_lambda))

        anomalies_table = dynamodb.Table(self, f"AnomaliesTable{suffix}",
            partition_key=dynamodb.Attribute(
                name="anomalyId",
                type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True
        )

        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "dynamodb:Scan",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:PutItem"
            ],
            resources=[sets_table.table_arn, anomalies_table.table_arn]
        ))

        anomaly_detection_lambda = _lambda.Function(self, f"AnomalyDetectionLambda{suffix}",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="anomaly_detection_lambda.lambda_handler", 
            code=_lambda.Code.from_asset("backend/aux_lambdas/anomaly_detector"),  
            role=lambda_role,
            timeout=Duration.minutes(5),
            environment={
                "SETS_TABLE": sets_table.table_name,
                "ANOMALIES_TABLE": anomalies_table.table_name
            }
        )

        daily_anomaly_rule = events.Rule(self, f"GainsIQDailyAnomalyRule{suffix}",
            schedule=events.Schedule.rate(Duration.hours(24)) 
        )

        daily_anomaly_rule.add_target(targets.LambdaFunction(anomaly_detection_lambda))