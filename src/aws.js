const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');

async function startEc2Instance(label, githubRegistrationToken) {
  const ec2 = new AWS.EC2();

  // User data scripts are run as the root user.
  // Docker and git are necessary for GitHub runner and should be pre-installed on the AMI.
  const userData = [
    '#!/bin/bash',
    'mkdir actions-runner && cd actions-runner',
    'curl -O -L https://github.com/actions/runner/releases/download/v2.275.1/actions-runner-linux-x64-2.275.1.tar.gz',
    'tar xzf ./actions-runner-linux-x64-2.275.1.tar.gz',
    'export RUNNER_ALLOW_RUNASROOT=1',
    `./config.sh --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label}`,
    './run.sh',
  ];

  const params = {
    ImageId: config.input.ec2ImageId,
    InstanceType: config.input.ec2InstanceType,
    MinCount: 1,
    MaxCount: 1,
    UserData: Buffer.from(userData.join('\n')).toString('base64'),
    SubnetId: config.input.subnetId,
    SecurityGroupIds: [config.input.securityGroupId],
    IamInstanceProfile: { Name: config.input.iamRoleName },
    TagSpecifications: config.tagSpecifications,
  };

  try {
    const result = await ec2.runInstances(params).promise();
    const ec2InstanceId = result.Instances[0].InstanceId;
    core.info(`AWS EC2 instance ${ec2InstanceId} is started`);
    return ec2InstanceId;
  } catch (error) {
    core.error('AWS EC2 instance starting error');
    throw error;
  }
}

async function terminateEc2Instance() {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [config.input.ec2InstanceId],
  };

  try {
    await ec2.terminateInstances(params).promise();
    core.info(`AWS EC2 instance ${config.input.ec2InstanceId} is terminated`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${config.input.ec2InstanceId} termination error`);
    throw error;
  }
}

async function waitForInstanceRunning(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.waitFor('instanceRunning', params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is up and running`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} init error`);
    throw error;
  }
}

module.exports = {
  startEc2Instance,
  //stopEc2Instances,
  terminateEc2Instance,
  waitForInstanceRunning,
};
