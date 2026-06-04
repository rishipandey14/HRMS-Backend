const {redis} = require("../app");

const getCachedData = (key) => async (req, res, next) => {
    const data = await redis.get(key);
    if(data){
        return res.json({
            data : JSON.parse(data),
        });
    }
    next();
};

module.exports = {getCachedData};