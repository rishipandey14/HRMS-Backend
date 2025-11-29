const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    companyId: { type: String, ref: "Company", required: true },
    loginAt: { type: Date, required: true },
    logoutAt: { type: Date, default: null },
    durationHours: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, logoutAt: 1 });
sessionSchema.index({ companyId: 1, loginAt: 1 });

sessionSchema.pre("save", function (next) {
  if (this.logoutAt && this.loginAt) {
    const diff = this.logoutAt.getTime() - this.loginAt.getTime();
    if (diff < 0) {
      return next(new Error("logoutAt cannot be earlier than loginAt"));
    }
    this.durationHours = diff / (1000 * 60 * 60);
  }
  next();
});

module.exports = mongoose.model("Session", sessionSchema);
