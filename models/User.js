const mongoose = require('mongoose');
const Uptime = require("./Uptime");
const Session = require("./Session");

const userSchema = new mongoose.Schema({
  _id: { type: String }, // 12-digit custom ID
  companyCode: {type: String, ref: 'Company'},
  name: String,
  email: { type: String, unique: true },
  password: String,
  mobile: String,
  role: { type: String, enum: ['user', 'admin', 'sadmin', 'unauthorized'], default: 'unauthorized' }
}, { timestamps: true });

userSchema.index({ companyCode: 1 });
userSchema.index({ role: 1 });

userSchema.pre("findOneAndDelete", async function (next) {
  try {
    const filter = this.getFilter();
    const user = await this.model.findOne(filter);
    if (user) {
      const userId = user._id;

      await Uptime.deleteMany({ userId });

      await Session.deleteMany({ userId });
    }
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('User', userSchema);