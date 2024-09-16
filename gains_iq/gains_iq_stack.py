from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_sagemaker as sagemaker,
    aws_s3_deployment as s3deploy,
    aws_ses as ses,
    aws_events as events,
    aws_events_targets as targets,
    aws_iam as iam
)
from constructs import Construct
from aws_cdk.aws_apigateway import Cors

class GainsIQStack(Stack):

    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # S3 bucket for GainsIQ frontend
        frontend_bucket = s3.Bucket(self, "GainsIQFrontend",
                                    website_index_document="index.html",
                                    public_read_access=True,
                                    block_public_access=s3.BlockPublicAccess.BLOCK_ACLS)

        s3deploy.BucketDeployment(self, "DeployWebsite",
                                  sources=[s3deploy.Source.asset("./frontend/build")],
                                  destination_bucket=frontend_bucket)

        # DynamoDB table for storing exercises
        exercises_table = dynamodb.Table(self, "ExercisesTable",
                                         partition_key=dynamodb.Attribute(
                                             name="exerciseName", type=dynamodb.AttributeType.STRING),
                                         billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)

        # DynamoDB table for logging sets
        sets_table = dynamodb.Table(self, "SetsTable",
                                    partition_key=dynamodb.Attribute(
                                        name="workoutId", type=dynamodb.AttributeType.STRING),
                                    sort_key=dynamodb.Attribute(
                                        name="timestamp", type=dynamodb.AttributeType.NUMBER),
                                    billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)

        # S3 bucket for storing workout data and analysis results
        data_bucket = s3.Bucket(self, "GainsIQDataBucket",
                                versioned=True)

        # Create an IAM Role with necessary permissions for both Lambdas
        lambda_role = iam.Role(self, "GainsIQLambdaRole",
                               assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
                               managed_policies=[
                                   iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
                               ])

        # Grant explicit permissions for Lambda to interact with DynamoDB and S3
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem"
            ],
            resources=[exercises_table.table_arn, sets_table.table_arn]
        ))

        # Grant permissions for Lambda to interact with S3
        data_bucket.grant_read_write(lambda_role)

        # Use IAM Role for SageMaker
        sagemaker_role = iam.Role(self, "SageMakerRole",
                                  assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
                                  managed_policies=[
                                      iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSageMakerFullAccess")
                                  ])

        # Add iam:PassRole permission so Lambda can pass the **SageMaker role** to SageMaker
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["iam:PassRole"],
            resources=[sagemaker_role.role_arn]  # Reference SageMaker role here, after it's defined
        ))

        # Add policy for SageMaker actions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["sagemaker:CreateProcessingJob"],
            resources=["*"]
        ))

        # Backend Lambda function for the workout tracker API
        backend_lambda = _lambda.Function(self, "GainsIQBackendHandler",
                                          runtime=_lambda.Runtime.PYTHON_3_8,
                                          handler="backend.main",
                                          code=_lambda.Code.from_asset("lambda"),
                                          role=lambda_role,
                                          environment={
                                              'EXERCISES_TABLE': exercises_table.table_name,
                                              'SETS_TABLE': sets_table.table_name
                                          })

        # Create the SageMaker model (Placeholder for future processing jobs)
        model = sagemaker.CfnModel(self, "GainsIQSageMakerModel",
                                   execution_role_arn=sagemaker_role.role_arn,
                                   primary_container=sagemaker.CfnModel.ContainerDefinitionProperty(
                                       image="174872318107.dkr.ecr.us-west-2.amazonaws.com/linear-learner:latest",
                                   ))

        # Processing Lambda function to handle monthly workout analysis and trigger SageMaker
        processing_lambda = _lambda.Function(self, "GainsIQProcessingLambda",
                                             runtime=_lambda.Runtime.PYTHON_3_8,
                                             handler="processing_lambda.lambda_handler",
                                             code=_lambda.Code.from_asset("lambda"),
                                             role=lambda_role,
                                             environment={
                                                 'SETS_TABLE': sets_table.table_name,
                                                 'EXERCISES_TABLE': exercises_table.table_name,
                                                 'S3_BUCKET_NAME': data_bucket.bucket_name,
                                                 'SAGEMAKER_MODEL_NAME': model.attr_model_name,  # Set SageMaker model name
                                                 'SAGEMAKER_ROLE_ARN': sagemaker_role.role_arn  # Correct SageMaker role ARN
                                             })

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

        # SES placeholder for email sending (to be integrated later)
        ses_identity = ses.CfnEmailIdentity(self, "GainsIQSESIdentity",
                                            email_identity="your-email@example.com")

        # EventBridge rule to trigger processing Lambda every month
        monthly_rule = events.Rule(self, "GainsIQMonthlyRule",
                                   schedule=events.Schedule.cron(minute="0", hour="0", day="1", month="*", year="*"))

        # Attach the monthly trigger to the processing Lambda
        monthly_rule.add_target(targets.LambdaFunction(processing_lambda))