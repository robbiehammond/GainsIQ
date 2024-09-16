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

class GainsIQStack(Stack):

    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # S3 bucket for GainsIQ frontend
        bucket = s3.Bucket(self, "GainsIQFrontend",
                   website_index_document="index.html",
                   public_read_access=True,
                   block_public_access=s3.BlockPublicAccess.BLOCK_ACLS)

        s3deploy.BucketDeployment(self, "DeployWebsite",
                          sources=[s3deploy.Source.asset("./frontend/build")],
                          destination_bucket=bucket)

        # DynamoDB Table for GainsIQ workout data
        table = dynamodb.Table(self, "GainsIQWorkoutData",
                               partition_key=dynamodb.Attribute(
                                   name="userId", type=dynamodb.AttributeType.STRING),
                               sort_key=dynamodb.Attribute(
                                   name="timestamp", type=dynamodb.AttributeType.NUMBER),
                               billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST)

        backend_lambda = _lambda.Function(self, "GainsIQBackendHandler",
                                  runtime=_lambda.Runtime.PYTHON_3_8,
                                  handler="backend.main",
                                  code=_lambda.Code.from_asset("lambda"))
        

        # API Gateway for exposing Lambda for GainsIQ
        api = apigateway.RestApi(self, "GainsIQAPI",
                                 rest_api_name="GainsIQ API",
                                 description="API for GainsIQ workout tracker.")

        workouts = api.root.add_resource("workouts")
        workouts.add_method("POST", apigateway.LambdaIntegration(backend_lambda))

        # Use aws_iam.Role for SageMaker Role
        sagemaker_role = iam.Role(self, "SageMakerRole",
                                  assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
                                  managed_policies=[
                                      iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSageMakerFullAccess")
                                  ])

        # Placeholder for SageMaker instance for future AI processing
        model = sagemaker.CfnModel(self, "GainsIQSageMakerModel",
                                   execution_role_arn=sagemaker_role.role_arn,
                                   primary_container=sagemaker.CfnModel.ContainerDefinitionProperty(
                                       image="174872318107.dkr.ecr.us-west-2.amazonaws.com/linear-learner:latest",
                                   ))

        # SES - Placeholder for GainsIQ email sending
        ses_identity = ses.CfnEmailIdentity(self, "GainsIQSESIdentity",
                                            email_identity="your-email@example.com")

        # EventBridge rule to trigger Lambda every month for GainsIQ summaries
        rule = events.Rule(self, "GainsIQMonthlyWorkoutSummary",
                           schedule=events.Schedule.cron(minute="0", hour="0", day="1", month="*", year="*"))

        # Attach the monthly trigger to the Lambda (for future SageMaker integration)
        rule.add_target(targets.LambdaFunction(backend_lambda))