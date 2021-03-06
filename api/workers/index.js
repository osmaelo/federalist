const { QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');

const { app: appConfig, redis: redisConfig } = require('../../config');
const { logger } = require('../../winston');

const { MailQueueName, ScheduledQueue, ScheduledQueueName } = require('../queues');

const Processors = require('./jobProcessors');
const Mailer = require('./Mailer');
const QueueWorker = require('./QueueWorker');

const EVERY_TEN_MINUTES_CRON = '0,10,20,30,40,50 * * * *';
const NIGHTLY_CRON = '0 5 * * *';

const everyTenMinutesJobConfig = {
  repeat: { cron: EVERY_TEN_MINUTES_CRON },
  priority: 1,
};

const nightlyJobConfig = {
  repeat: { cron: NIGHTLY_CRON },
  priority: 10,
};

async function start() {
  const mailer = new Mailer();
  await mailer.verify();

  const connection = new IORedis(redisConfig.url, {
    tls: redisConfig.tls,
  });

  // Processors
  const scheduledJobProcessor = Processors.multiJobProcessor({
    archiveBuildLogsDaily: Processors.archiveBuildLogsDaily,
    nightlyBuilds: Processors.nightlyBuilds,
    revokeMembershipForInactiveUsers: Processors.revokeMembershipForInactiveUsers,
    timeoutBuilds: Processors.timeoutBuilds,
    verifyRepositories: Processors.verifyRepositories,
  });

  const mailJobProcessor = job => mailer.send(job.data);

  // Workers
  const workers = [
    new QueueWorker(ScheduledQueueName, connection, scheduledJobProcessor),
    new QueueWorker(MailQueueName, connection, mailJobProcessor),
  ];

  // Schedulers
  const schedulers = [
    new QueueScheduler(ScheduledQueueName, { connection }),
    new QueueScheduler(MailQueueName, { connection }),
  ];

  // Queues
  const scheduledQueue = new ScheduledQueue(connection);

  const cleanup = async () => {
    logger.info('Worker process received request to shutdown, cleaning up and shutting down.');
    await Promise.all(
      [
        ...workers,
        ...schedulers,
        scheduledQueue,
        mailer,
      ].map(closable => closable.close())
    );
    logger.info('Worker process all cleaned up, shutting down.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);

  // Jobs
  const jobs = [
    scheduledQueue.add('timeoutBuilds', {}, everyTenMinutesJobConfig),
    scheduledQueue.add('nightlyBuilds', {}, nightlyJobConfig),
    scheduledQueue.add('verifyRepositories', {}, nightlyJobConfig),
    scheduledQueue.add('revokeMembershipForInactiveUsers', {}, nightlyJobConfig),
  ];

  if (appConfig.app_env === 'production') {
    jobs.push(scheduledQueue.add('archiveBuildLogsDaily', {}, nightlyJobConfig));
  }

  await scheduledQueue.drain(); // clear the queue
  await Promise.all(jobs);
}

start()
  .catch(logger.err);
