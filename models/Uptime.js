const mongoose = require("mongoose");

const uptimeSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    companyId: { type: String, ref: "Company" },
    week: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{4}-W\d{2}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid ISO week format (YYYY-Www)!`,
      },
    },
    dailyHours: {
      Mon: { type: Number, default: 0 },
      Tue: { type: Number, default: 0 },
      Wed: { type: Number, default: 0 },
      Thu: { type: Number, default: 0 },
      Fri: { type: Number, default: 0 },
      Sat: { type: Number, default: 0 },
      Sun: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

uptimeSchema.index({ userId: 1, week: 1 }, { unique: true });
uptimeSchema.index({ companyId: 1 });

uptimeSchema.pre("save", function (next) {
  const hours = Object.values(this.dailyHours);
  if (hours.some((h) => h < 0 || h > 24)) {
    return next(new Error("Daily hours must be between 0 and 24."));
  }
  next();
});

uptimeSchema.virtual("totalHours").get(function () {
  return Object.values(this.dailyHours).reduce((a, b) => a + b, 0);
});

module.exports = mongoose.model("Uptime", uptimeSchema);
