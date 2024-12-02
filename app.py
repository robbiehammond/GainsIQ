#!/usr/bin/env python3
import os

import aws_cdk as cdk

from cfn_stack.gains_iq_stack import GainsIQStack

aws_account_id = os.getenv("AWS_ACCOUNT_ID")
aws_region = os.getenv("REGION")

if not aws_account_id or not aws_region:
    raise ValueError("Both AWS_ACCOUNT_ID and REGION environment variables must be set.")

app = cdk.App()


env_name = app.node.try_get_context("env") or "prod"

environment_config = {
    "prod": {
        "stack_name": "GainsIqStack",
    },
    "preprod": {
        "stack_name": "GainsIqStack-Preprod",
    },
}[env_name]

GainsIQStack(
    app, 
    environment_config["stack_name"],
    env_name=env_name
)

app.synth()
