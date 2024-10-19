const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.register = async (req, res) => {
    // 注册逻辑
        try {
            const { username, password, email } = req.body;
    
            // 对密码进行加密
            const hashedPassword = await bcrypt.hash(password, 10);
            // 创建新用户
            const newUser = await User.create({
                username,
                password: hashedPassword, // 存储加密后的密码
                email
            });
    
            res.status(201).json({ message: '用户注册成功', user: newUser,code:201 });
        } catch (error) {
            res.status(500).json({ message: '用户注册失败', error,code:500 });
        }
};

exports.login = async (req, res) => {
    // 登录逻辑
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(404).json({ message: '用户未找到',code:404 });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: '密码错误',code:400 });
        }

        res.status(200).json({ message: '登录成功', user ,code:200});
    } catch (error) {
        res.status(500).json({ message: '登录失败', error,code:500 });
    }
};
