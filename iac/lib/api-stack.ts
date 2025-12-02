import path from 'node:path';
import { CfnOutput, Duration, Fn, Stack, type StackProps } from 'aws-cdk-lib';
import {
  type CfnMethod,
  EndpointType,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import lambda, { Architecture, DockerImageCode } from 'aws-cdk-lib/aws-lambda';

import type { Construct } from 'constructs';

export class WebAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webApiLambda = new lambda.DockerImageFunction(this, 'webApiLambda', {
      code: DockerImageCode.fromImageAsset(
        path.resolve(import.meta.dirname!, '../..')
      ),
      memorySize: 512,
      timeout: Duration.seconds(15 * 60),
      architecture: Architecture.ARM_64,
      environment: {
        AWS_LWA_INVOKE_MODE: 'response_stream',
      },
    });

    const restApi = new RestApi(this, 'RestApi', {
      endpointTypes: [EndpointType.REGIONAL],
    });

    const lambdaIntegration = new LambdaIntegration(webApiLambda);
    const rootMethod = restApi.root.addMethod('ANY', lambdaIntegration);
    const proxyMethod = restApi.root
      .addResource('{proxy+}')
      .addMethod('ANY', lambdaIntegration);

    // ストリーミング対応の設定（CloudFormationオーバーライド）
    [rootMethod, proxyMethod].forEach((method) => {
      const cfnMethod = method.node.defaultChild as CfnMethod;
      cfnMethod.addOverride(
        'Properties.Integration.ResponseTransferMode',
        'STREAM'
      );
      cfnMethod.addOverride('Properties.Integration.TimeoutInMillis', 900000);
      cfnMethod.addOverride(
        'Properties.Integration.Uri',
        Fn.sub(
          'arn:aws:apigateway:${AWS::Region}:lambda:path/2021-11-15/functions/${LambdaArn}/response-streaming-invocations',
          { LambdaArn: webApiLambda.functionArn }
        )
      );
    });

    new CfnOutput(this, 'RestApiUrl', {
      value: restApi.url,
    });
  }
}
