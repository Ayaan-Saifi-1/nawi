import cron from 'node-cron';
import { ReportJob } from '../models/ReportJob.js';
import { generateReport } from '../services/reportGenerator.service.js';

let isWorkerRunning = false;

export async function processReportJobs() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const jobs = await ReportJob.find({ status: 'queued' }).sort({ createdAt: 1 }).limit(5);

    for (const job of jobs) {
      try {
        job.status = 'running';
        job.startedAt = new Date();
        await job.save();

        const report = await generateReport({
          testSessionId: job.testSessionId,
          userId: job.requestedBy,
          remarks: job.remarks,
          format: job.format,
          language: job.language,
        });

        job.status = 'done';
        job.reportId = report._id;
        job.completedAt = new Date();
        await job.save();
      } catch (err) {
        console.error(`Error processing report job ${job._id}:`, err);
        job.retryCount += 1;
        if (job.retryCount >= 3) {
          job.status = 'failed';
          job.error = err.message || 'Unknown error';
        } else {
          // Re-queue
          job.status = 'queued';
        }
        await job.save();
      }
    }
  } catch (err) {
    console.error('Report worker error:', err);
  } finally {
    isWorkerRunning = false;
  }
}

export function startReportWorker() {
  // Run every 10 seconds
  cron.schedule('*/10 * * * * *', () => {
    processReportJobs().catch(console.error);
  });
}
