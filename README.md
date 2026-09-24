# ownProject
noIdea front end back-end
仿流萤书签个人网站搭建的个人网站
运行前准备工作/环境之类：
安装对应软件包括但不限于vscode git mysql
git clone 将代码拉下来

把 Git 目录添加到环境变量

按 Win + R，输入：

sysdm.cpl

打开后依次进入：

高级 → 环境变量 → 上方“用户变量”里的 Path → 编辑 → 新建

添加这一行，安装位置不同就对应修改：

C:\Program Files\Git\cmd

git pull失败解决

终端执行下面代码，拿到ProxyServer
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
Select-Object ProxyEnable, ProxyServer, AutoConfigURL

git config --global http.proxy http://127.0.0.1:7897（ProxyServer）
git config --global https.proxy http://127.0.0.1:7897（ProxyServer）
