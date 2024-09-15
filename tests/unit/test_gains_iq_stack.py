import aws_cdk as core
import aws_cdk.assertions as assertions

from gains_iq.gains_iq_stack import GainsIqStack

# example tests. To run these tests, uncomment this file along with the example
# resource in gains_iq/gains_iq_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = GainsIqStack(app, "gains-iq")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
