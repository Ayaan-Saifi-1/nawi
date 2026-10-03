import { TestSession } from '../models/TestSession.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { Manufacturer } from '../models/Manufacturer.js';
import { Report } from '../models/Report.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getManufacturerForUser, sessionScopeForUser } from '../utils/tenantAccess.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { role, labId } = req.user;

  const sessionFilter = await sessionScopeForUser(req.user);
  let modelFilter = {};

  if (role === 'manufacturer') {
    const mfg = await getManufacturerForUser(req.user.sub);
    modelFilter = mfg ? { manufacturerId: mfg._id } : { manufacturerId: null };
  }

  const matchingSessions = await TestSession.find(sessionFilter).select('_id');
  const sessionIds = matchingSessions.map((s) => s._id);
  const reportFilter = { testSessionId: { $in: sessionIds } };

  const now = new Date();
  const startDateTrend = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalSessions,
    passedCount,
    failedCount,
    totalReports,
    totalInstruments,
    totalManufacturers,
    statusGroup,
    accuracyGroup,
    labGroup,
    monthlyGroup,
    reportStatusGroup,
  ] = await Promise.all([
    TestSession.countDocuments(sessionFilter),
    TestSession.countDocuments({ ...sessionFilter, overallResult: 'pass' }),
    TestSession.countDocuments({ ...sessionFilter, overallResult: 'fail' }),
    Report.countDocuments(reportFilter),
    InstrumentModel.countDocuments(modelFilter),
    ['admin', 'doca_officer'].includes(role) ? Manufacturer.countDocuments() : Promise.resolve(0),
    TestSession.aggregate([
      { $match: sessionFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TestSession.aggregate([
      { $match: sessionFilter },
      {
        $lookup: {
          from: 'instrumentmodels',
          localField: 'instrumentModelId',
          foreignField: '_id',
          as: 'model',
        },
      },
      { $unwind: { path: '$model', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$accuracyClass', '$model.accuracyClass'] },
          count: { $sum: 1 },
        },
      },
    ]),
    TestSession.aggregate([
      { $match: sessionFilter },
      { $group: { _id: '$labId', count: { $sum: 1 } } },
    ]),
    TestSession.aggregate([
      { $match: { ...sessionFilter, testDate: { $gte: startDateTrend } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$testDate' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate([
      { $match: reportFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusBreakdown = { draft: 0, submitted: 0, under_review: 0, passed: 0, failed: 0, report_generated: 0, published: 0 };
  for (const item of statusGroup) {
    if (item._id && statusBreakdown[item._id] !== undefined) {
      statusBreakdown[item._id] = item.count;
    }
  }

  const byAccuracyClass = { I: 0, II: 0, III: 0, IIII: 0 };
  for (const item of accuracyGroup) {
    if (item._id && byAccuracyClass[item._id] !== undefined) {
      byAccuracyClass[item._id] = item.count;
    }
  }

  const sessionsByLab = {};
  for (const item of labGroup) {
    if (item._id) {
      sessionsByLab[item._id] = item.count;
    }
  }

  const reportStatusBreakdown = { integrity_tagged: 0, published: 0, archived: 0, revoked: 0 };
  for (const item of reportStatusGroup) {
    if (item._id && reportStatusBreakdown[item._id] !== undefined) {
      reportStatusBreakdown[item._id] = item.count;
    }
  }

  const monthlyTrendMap = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
    monthlyTrendMap.set(yearMonth, { yearMonth, month: `${monthLabel} ${d.getFullYear()}`, count: 0 });
  }

  for (const item of monthlyGroup) {
    if (monthlyTrendMap.has(item._id)) {
      monthlyTrendMap.get(item._id).count = item.count;
    }
  }

  const monthlyTrend = Array.from(monthlyTrendMap.values());

  res.status(200).json({
    success: true,
    data: {
      totalSessions,
      passedCount,
      failedCount,
      totalReports,
      totalInstruments,
      totalManufacturers,
      statusBreakdown,
      reportStatusBreakdown,
      byAccuracyClass,
      sessionsByLab,
      monthlyTrend,
      userRole: role,
    },
  });
});
