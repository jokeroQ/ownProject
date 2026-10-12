CREATE TABLE users (id INTEGER PRIMARY KEY AUTO_INCREMENT, username VARCHAR(255) NOT NULL UNIQUE,
 password VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME NOT NULL);
CREATE TABLE menus (id INTEGER PRIMARY KEY AUTO_INCREMENT, `index` VARCHAR(255), title VARCHAR(255) NOT NULL);
CREATE TABLE menulists (id INTEGER PRIMARY KEY AUTO_INCREMENT, menu_id INTEGER NOT NULL, `order` INTEGER NOT NULL,
 icon VARCHAR(255), title VARCHAR(255), type VARCHAR(255), targetUrl VARCHAR(255),
 FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO menus VALUES (1,'1','学习网站'),(2,'2','视频网站'),(3,'3','图片素材'),(4,'4','常用工具'),(5,'5','功能'),(9,'9','测试');
INSERT INTO menulists (menu_id,`order`,title,targetUrl) VALUES
 (1,1,'学习1','https://example.com/1'),(1,2,'学习2','https://example.com/2'),
 (1,3,'学习3','https://example.com/3'),(1,4,'学习4','https://example.com/4'),
 (2,1,'视频1','https://example.com/5'),(2,2,'视频2','https://example.com/6'),
 (3,1,'图片','https://example.com/7'),(4,1,'工具','https://example.com/8'),
 (5,1,'聊天','/chat'),(5,2,'签名','/signPad'),(9,1,'测试','/test');
