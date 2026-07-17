import prisma from '../prismaClient';

export const calculateMonthlyReportRate = async (userId: number) => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let workdaysElapsed = 0;
  for (let d = new Date(firstDayOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      workdaysElapsed++;
    }
  }
  
  if (workdaysElapsed === 0) workdaysElapsed = 1; // Prevent division by zero

  const reportsThisMonth = await prisma.dailyReport.count({
    where: { 
      userId,
      reportDate: { gte: firstDayOfMonth }
    }
  });
  
  return Math.min(100, (reportsThisMonth / workdaysElapsed) * 100).toFixed(1);
};
