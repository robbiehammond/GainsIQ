from aws_cdk import (
    BundlingOptions,
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
    aws_logs as logs,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_stepfunctions as sfn,
    aws_stepfunctions_tasks as tasks
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
                                    public_read_access=False,
                                    block_public_access=s3.BlockPublicAccess.BLOCK_ALL)

        # Origin Access Identity for CloudFront
        origin_access_identity = cloudfront.OriginAccessIdentity(self, f"GainsIQOAI{suffix}")
        frontend_bucket.grant_read(origin_access_identity)

        # CloudFront distribution for HTTPS
        distribution = cloudfront.Distribution(self, f"GainsIQDistribution{suffix}",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(frontend_bucket, origin_access_identity=origin_access_identity),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html"
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html"
                )
            ]
        )

        s3deploy.BucketDeployment(self, f"DeployWebsite{suffix}",
                                  sources=[s3deploy.Source.asset("./frontend/build")],
                                  destination_bucket=frontend_bucket,
                                  distribution=distribution,
                                  distribution_paths=["/*"])

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
        backend_lambda = _lambda.Function(self, f"GainsIQGoBackendHandler{suffix}",
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
                                                    'QUEUE_URL': processing_lambda_trigger_queue.queue_url,
                                                    'API_KEY_MAP': api_keys_json
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
        exercises.add_method("PUT", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        exercises.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        sets = api.root.add_resource("sets")
        log = sets.add_resource("log")
        log.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        pop_set = sets.add_resource("pop")
        pop_set.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        sets.add_method("DELETE", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        sets.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
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
        trend = weight.add_resource("trend")
        trend.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        analysis = api.root.add_resource("analysis")
        analysis.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))
        analysis.add_method("POST", apigateway.LambdaIntegration(backend_lambda, proxy=True))

        analytics = api.root.add_resource("analytics")
        volume = analytics.add_resource("volume")
        bodypart = volume.add_resource("bodypart")
        bodypart.add_method("GET", apigateway.LambdaIntegration(backend_lambda, proxy=True))

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

        # Oura Integration
        self._setup_oura_integration(suffix, lambda_role, oura_api_key)

    def _setup_oura_integration(self, suffix: str, lambda_role: iam.Role, oura_api_key: str):
        """Set up Oura Ring integration with Step Functions"""
        
        # DynamoDB table for sleep data
        oura_sleep_table = dynamodb.Table(self, f"OuraSleepTable{suffix}",
            partition_key=dynamodb.Attribute(name="date", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True
        )

        # Grant DynamoDB permissions for Oura integration
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            resources=[oura_sleep_table.table_arn]
        ))

        # Create Lambda functions
        lambdas = self._create_oura_lambdas(suffix, lambda_role, oura_api_key, oura_sleep_table)
        
        # Create Step Function
        state_machine = self._create_oura_step_function(suffix, lambdas)
        
        # Set up daily trigger
        self._setup_oura_schedule(suffix, state_machine)

    def _create_oura_lambdas(self, suffix: str, lambda_role: iam.Role, oura_api_key: str, oura_sleep_table: dynamodb.Table):
        """Create all Lambda functions for Oura integration"""
        
        lambda_config = {
            'runtime': _lambda.Runtime.PYTHON_3_9,
            'code': _lambda.Code.from_asset("backend/oura_integration/lambdas", 
                bundling=BundlingOptions(
                    image=_lambda.Runtime.PYTHON_3_9.bundling_image,
                    command=[
                        "bash", "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -au . /asset-output"
                    ],
                )
            ),
            'role': lambda_role
        }
        
        lambdas = {}
        
        # Check missing dates Lambda
        lambdas['check_missing'] = _lambda.Function(self, f"OuraCheckMissingLambda{suffix}",
            handler="check_missing.lambda_handler",
            environment={'OURA_SLEEP_TABLE': oura_sleep_table.table_name},
            timeout=Duration.seconds(30),
            **lambda_config
        )
        
        # Fetch data Lambda
        lambdas['fetch'] = _lambda.Function(self, f"OuraFetchLambda{suffix}",
            handler="fetch_data.lambda_handler",
            environment={'OURA_API_KEY': oura_api_key},
            timeout=Duration.seconds(30),
            **lambda_config
        )
        
        # Validate data Lambda
        lambdas['validate'] = _lambda.Function(self, f"OuraValidateLambda{suffix}",
            handler="validate_data.lambda_handler",
            timeout=Duration.seconds(15),
            **lambda_config
        )
        
        # Store data Lambda
        lambdas['store'] = _lambda.Function(self, f"OuraStoreLambda{suffix}",
            handler="store_data.lambda_handler",
            environment={'OURA_SLEEP_TABLE': oura_sleep_table.table_name},
            timeout=Duration.seconds(30),
            **lambda_config
        )
        
        # Log error Lambda
        lambdas['log_error'] = _lambda.Function(self, f"OuraLogErrorLambda{suffix}",
            handler="log_error.lambda_handler",
            timeout=Duration.seconds(15),
            **lambda_config
        )
        
        # Summary Lambda
        lambdas['summary'] = _lambda.Function(self, f"OuraSummaryLambda{suffix}",
            handler="summary.lambda_handler",
            environment={'OURA_SLEEP_TABLE': oura_sleep_table.table_name},
            timeout=Duration.seconds(15),
            **lambda_config
        )
        
        # Process and Store Lambda (new bulk processing function)
        lambdas['process_and_store'] = _lambda.Function(self, f"OuraProcessAndStoreLambda{suffix}",
            handler="process_and_store.lambda_handler",
            environment={'OURA_SLEEP_TABLE': oura_sleep_table.table_name},
            timeout=Duration.minutes(5),
            **lambda_config
        )
        
        return lambdas

    def _create_oura_step_function(self, suffix: str, lambdas: dict):
        """Create Step Function state machine for Oura sync"""
        
        # Load and process step function definition
        with open('backend/oura_integration/step_functions/oura_sync.json', 'r') as f:
            step_function_definition = f.read()
        
        # Replace placeholders with actual Lambda ARNs
        replacements = {
            '${OuraCheckMissingLambda}': lambdas['check_missing'].function_arn,
            '${OuraFetchLambda}': lambdas['fetch'].function_arn,
            '${OuraProcessAndStoreLambda}': lambdas['process_and_store'].function_arn,
            '${OuraLogErrorLambda}': lambdas['log_error'].function_arn,
            '${OuraSummaryLambda}': lambdas['summary'].function_arn
        }
        
        for placeholder, arn in replacements.items():
            step_function_definition = step_function_definition.replace(placeholder, arn)

        # Create Step Function
        state_machine = sfn.StateMachine(self, f"OuraSyncStateMachine{suffix}",
            definition_body=sfn.DefinitionBody.from_string(step_function_definition),
            timeout=Duration.minutes(15),
            logs=sfn.LogOptions(
                destination=logs.LogGroup(self, f"OuraSyncLogGroup{suffix}"),
                level=sfn.LogLevel.ALL
            )
        )

        # Grant Step Function permissions to invoke Lambda functions
        for lambda_func in lambdas.values():
            lambda_func.grant_invoke(state_machine)
        
        return state_machine

    def _setup_oura_schedule(self, suffix: str, state_machine: sfn.StateMachine):
        """Set up daily trigger for Oura sync"""
        
        # Daily trigger for Oura sync at noon PST (8 PM UTC)
        daily_oura_sync_rule = events.Rule(self, f"OuraDailySyncRule{suffix}",
            schedule=events.Schedule.cron(minute="0", hour="20", day="*", month="*", year="*")
        )

        # Add Step Function as target
        daily_oura_sync_rule.add_target(targets.SfnStateMachine(state_machine))