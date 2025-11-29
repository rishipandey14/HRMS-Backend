const { getISOWeek, getISOWeekYear } = require("date-fns");

function getISOWeekString(date) {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

function getWeekDayName(date) {
  const dayNumber = date.getDay();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return dayNames[dayNumber];
}

module.exports = {
  getISOWeekString,
  getWeekDayName,
};
