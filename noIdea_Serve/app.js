const express = require('express');
const app = express();
const sequelize = require('./config/db');
const userRoutes = require('./routes/userRoutes'); 
app.use(express.json());
const cors = require('cors');

// 中间件
app.use(express.json()); // 解析 JSON 请求体
app.use(cors());
sequelize.authenticate()
    .then(() => {
        console.log('数据库连接成功！');
        return sequelize.sync(); // 同步模型到数据库
    })
    .then(() => {
        console.log('所有模型已成功同步');
    })
    .catch((err) => {
        console.error('数据库连接失败：', err);
    });
app.use('/api/users', userRoutes);
// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器正在运行在端口 ${PORT}`);
});