/*
 Navicat Premium Data Transfer

 Source Server         : 本地 MySQL
 Source Server Type    : MySQL
 Source Server Version : 260700
 Source Host           : localhost:3306
 Source Schema         : noidea

 Target Server Type    : MySQL
 Target Server Version : 260700
 File Encoding         : 65001

 Date: 12/10/2026 09:12:35
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for bookmark_templates
-- ----------------------------
DROP TABLE IF EXISTS `bookmark_templates`;
CREATE TABLE `bookmark_templates`  (
  `id` int NOT NULL,
  `content` json NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of bookmark_templates
-- ----------------------------
INSERT INTO `bookmark_templates` VALUES (1, '[{\"title\": \"学习网站2\", \"bookmarks\": [{\"desc\": null, \"icon\": \"\", \"type\": null, \"order\": 2, \"title\": \"github\", \"targetUrl\": \"https://chatgpt.com/\"}, {\"desc\": null, \"icon\": \"&#xe60b;\", \"type\": null, \"order\": 4, \"title\": \"gitee\", \"targetUrl\": \"https://gitee.com/hzw_0174/WarblerHomepage\"}, {\"desc\": null, \"icon\": \"&#xe603;\", \"type\": null, \"order\": 3, \"title\": \"掘金\", \"targetUrl\": \"https://juejin.cn/post/6963945204965441550\"}, {\"desc\": null, \"icon\": \"&#xe640;\", \"type\": null, \"order\": 1, \"title\": \"个人博客\", \"targetUrl\": \"https://www.duwanyu.com\"}]}, {\"title\": \"视频网站\", \"bookmarks\": [{\"desc\": null, \"icon\": \"&#xe640;\", \"type\": null, \"order\": 5, \"title\": \"b站\", \"targetUrl\": \"https://www.bilibili.com/\"}, {\"desc\": null, \"icon\": \"&#xe640;\", \"type\": null, \"order\": 6, \"title\": \"腾讯视频\", \"targetUrl\": \"https://v.qq.com/\"}]}, {\"title\": \"图片素材\", \"bookmarks\": [{\"desc\": null, \"icon\": \"\", \"type\": null, \"order\": 7, \"title\": \"阿里巴巴矢量库\", \"targetUrl\": \"https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1\"}]}, {\"title\": \"常用工具\", \"bookmarks\": [{\"desc\": null, \"icon\": \"&#xe640;\", \"type\": null, \"order\": 8, \"title\": \"ChatGPT\", \"targetUrl\": \"https://chat.openai.com/chat\"}]}, {\"title\": \"有趣功能点尝试\", \"bookmarks\": [{\"desc\": null, \"icon\": \"\", \"type\": null, \"order\": 10, \"title\": \"签名板\", \"targetUrl\": \"/signPad\"}, {\"desc\": null, \"icon\": \"&#xe640;\", \"type\": null, \"order\": 11, \"title\": \"聊天框样式\", \"targetUrl\": \"/chat\"}, {\"desc\": null, \"icon\": \"\", \"type\": \"\", \"order\": 12, \"title\": \"ces\", \"targetUrl\": \"/test\"}]}, {\"title\": \"test1\", \"bookmarks\": [{\"desc\": null, \"icon\": \"\", \"type\": null, \"order\": 12, \"title\": \"2323\", \"targetUrl\": \"2343\"}]}]');

-- ----------------------------
-- Table structure for menulists
-- ----------------------------
DROP TABLE IF EXISTS `menulists`;
CREATE TABLE `menulists`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `menu_id` int NULL DEFAULT NULL,
  `icon` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `targetUrl` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `title` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `type` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `order` int NOT NULL,
  `desc` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `menu_id`(`menu_id` ASC) USING BTREE,
  CONSTRAINT `fk_menulists_menus` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menuid` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_1` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_10` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_11` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_12` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_13` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_14` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_15` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_16` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_17` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_18` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_19` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_2` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_20` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_21` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_22` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_23` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_24` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_25` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_26` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_27` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_28` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_29` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_3` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_30` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_31` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_32` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_33` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_34` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_35` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_36` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_37` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_38` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_39` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_4` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_40` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_41` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_42` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_43` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_44` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_45` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_46` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_47` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_48` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_49` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_5` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_50` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_51` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_52` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menulists_ibfk_6` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_7` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_8` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `menulists_ibfk_9` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of menulists
-- ----------------------------
INSERT INTO `menulists` VALUES (1, 1, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (2, 1, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (3, 1, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (4, 1, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (5, 2, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (7, 3, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (8, 4, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (10, 5, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (11, 5, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (12, 9, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (15, 5, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (16, 10, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (17, 10, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (18, 10, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (19, 10, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (20, 11, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (21, 11, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (22, 12, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (23, 13, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (24, 14, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (25, 14, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (26, 14, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (27, 15, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (28, 16, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (29, 16, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (30, 16, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (31, 16, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (32, 17, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (33, 17, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (34, 18, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (35, 19, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (36, 20, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (37, 20, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (38, 20, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (39, 21, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (40, 22, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (41, 22, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (42, 22, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (43, 22, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (44, 23, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (45, 23, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (46, 24, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (47, 25, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (48, 26, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (49, 26, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (50, 26, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (51, 27, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (52, 28, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (53, 28, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (54, 28, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (55, 28, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (56, 29, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (57, 29, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (58, 30, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (59, 31, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (60, 32, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (61, 32, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (62, 32, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (63, 33, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (64, 34, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (65, 34, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (66, 34, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (67, 34, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (68, 35, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (69, 35, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (70, 36, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (71, 37, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (72, 38, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (73, 38, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (74, 38, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (75, 39, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (76, 40, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (77, 40, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (78, 40, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (79, 40, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (80, 41, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (81, 41, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (82, 42, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (83, 43, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (84, 44, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (85, 44, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (86, 44, '', '/test', 'ces', '', 12, NULL);
INSERT INTO `menulists` VALUES (87, 45, '', '2343', '2323', NULL, 12, NULL);
INSERT INTO `menulists` VALUES (88, 46, '', 'https://chatgpt.com/', 'github', NULL, 2, NULL);
INSERT INTO `menulists` VALUES (89, 46, '&#xe60b;', 'https://gitee.com/hzw_0174/WarblerHomepage', 'gitee', NULL, 4, NULL);
INSERT INTO `menulists` VALUES (90, 46, '&#xe603;', 'https://juejin.cn/post/6963945204965441550', '掘金', NULL, 3, NULL);
INSERT INTO `menulists` VALUES (91, 46, '&#xe640;', 'https://www.duwanyu.com', '个人博客', NULL, 1, NULL);
INSERT INTO `menulists` VALUES (92, 47, '&#xe640;', 'https://www.bilibili.com/', 'b站', NULL, 5, NULL);
INSERT INTO `menulists` VALUES (93, 47, '&#xe640;', 'https://v.qq.com/', '腾讯视频', NULL, 6, NULL);
INSERT INTO `menulists` VALUES (94, 48, '', 'https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.56063a81HWsFks&type=1', '阿里巴巴矢量库', NULL, 7, NULL);
INSERT INTO `menulists` VALUES (95, 49, '&#xe640;', 'https://chat.openai.com/chat', 'ChatGPT', NULL, 8, NULL);
INSERT INTO `menulists` VALUES (96, 50, '', '/signPad', '签名板', NULL, 10, NULL);
INSERT INTO `menulists` VALUES (97, 50, '&#xe640;', '/chat', '聊天框样式', NULL, 11, NULL);
INSERT INTO `menulists` VALUES (98, 50, '', '/test', 'ces', '', 12, NULL);

-- ----------------------------
-- Table structure for menus
-- ----------------------------
DROP TABLE IF EXISTS `menus`;
CREATE TABLE `menus`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `index` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL,
  `title` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `index`(`index` ASC) USING BTREE,
  INDEX `menus_user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `menus_owner_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of menus
-- ----------------------------
INSERT INTO `menus` VALUES (1, '1', '学习网站2', 20);
INSERT INTO `menus` VALUES (2, '2', '视频网站', 20);
INSERT INTO `menus` VALUES (3, '3', '图片素材', 20);
INSERT INTO `menus` VALUES (4, '4', '常用工具', 20);
INSERT INTO `menus` VALUES (5, '5', '有趣功能点尝试', 20);
INSERT INTO `menus` VALUES (9, '9', 'test1', 20);
INSERT INTO `menus` VALUES (10, '10', '学习网站2', 1);
INSERT INTO `menus` VALUES (11, '11', '视频网站', 1);
INSERT INTO `menus` VALUES (12, '12', '图片素材', 1);
INSERT INTO `menus` VALUES (13, '13', '常用工具', 1);
INSERT INTO `menus` VALUES (14, '14', '有趣功能点尝试', 1);
INSERT INTO `menus` VALUES (15, '15', 'test1', 1);
INSERT INTO `menus` VALUES (16, '16', '学习网站2', 2);
INSERT INTO `menus` VALUES (17, '17', '视频网站', 2);
INSERT INTO `menus` VALUES (18, '18', '图片素材', 2);
INSERT INTO `menus` VALUES (19, '19', '常用工具', 2);
INSERT INTO `menus` VALUES (20, '20', '有趣功能点尝试', 2);
INSERT INTO `menus` VALUES (21, '21', 'test1', 2);
INSERT INTO `menus` VALUES (22, '22', '学习网站2', 3);
INSERT INTO `menus` VALUES (23, '23', '视频网站', 3);
INSERT INTO `menus` VALUES (24, '24', '图片素材', 3);
INSERT INTO `menus` VALUES (25, '25', '常用工具', 3);
INSERT INTO `menus` VALUES (26, '26', '有趣功能点尝试', 3);
INSERT INTO `menus` VALUES (27, '27', 'test1', 3);
INSERT INTO `menus` VALUES (28, '28', '学习网站2', 4);
INSERT INTO `menus` VALUES (29, '29', '视频网站', 4);
INSERT INTO `menus` VALUES (30, '30', '图片素材', 4);
INSERT INTO `menus` VALUES (31, '31', '常用工具', 4);
INSERT INTO `menus` VALUES (32, '32', '有趣功能点尝试', 4);
INSERT INTO `menus` VALUES (33, '33', 'test1', 4);
INSERT INTO `menus` VALUES (34, '34', '学习网站2', 5);
INSERT INTO `menus` VALUES (35, '35', '视频网站', 5);
INSERT INTO `menus` VALUES (36, '36', '图片素材', 5);
INSERT INTO `menus` VALUES (37, '37', '常用工具', 5);
INSERT INTO `menus` VALUES (38, '38', '有趣功能点尝试', 5);
INSERT INTO `menus` VALUES (39, '39', 'test1', 5);
INSERT INTO `menus` VALUES (40, '40', '学习网站2', 6);
INSERT INTO `menus` VALUES (41, '41', '视频网站', 6);
INSERT INTO `menus` VALUES (42, '42', '图片素材', 6);
INSERT INTO `menus` VALUES (43, '43', '常用工具', 6);
INSERT INTO `menus` VALUES (44, '44', '有趣功能点尝试', 6);
INSERT INTO `menus` VALUES (45, '45', 'test1', 6);
INSERT INTO `menus` VALUES (46, '46', '学习网站2', 21);
INSERT INTO `menus` VALUES (47, '47', '视频网站', 21);
INSERT INTO `menus` VALUES (48, '48', '图片素材', 21);
INSERT INTO `menus` VALUES (49, '49', '常用工具', 21);
INSERT INTO `menus` VALUES (50, '50', '有趣功能点尝试', 21);

-- ----------------------------
-- Table structure for user_sessions
-- ----------------------------
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions`  (
  `token_hash` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token_hash`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_sessions
-- ----------------------------
INSERT INTO `user_sessions` VALUES ('88ce5003a6262bb6806076e27533a41b26cde11dfc7eb6de461351f905326040', 20, '2026-10-19 01:10:36');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_2`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_2`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_3`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_3`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_4`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_4`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_5`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_5`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_6`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_6`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_7`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_7`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_8`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_8`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_9`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_9`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_10`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_10`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_11`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_11`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_12`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_12`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_13`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_13`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_14`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_14`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_15`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_15`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_16`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_16`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_17`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_17`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_18`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_18`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_19`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_19`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_20`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_20`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_21`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_21`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_22`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_22`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_23`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_23`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_24`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_24`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_25`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_25`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_26`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_26`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_27`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_27`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_28`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_28`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_29`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_29`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_30`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_30`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_31`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email_31`(`email` ASC) USING BTREE,
  UNIQUE INDEX `username_32`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 21 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'testuser', '$2y$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'testuser@example.com', '2024-10-16 13:29:36');
INSERT INTO `users` VALUES (2, '454', '$2a$10$8CCHX2PcgR8JM0jp1fOIfeJvYU5oKhqWtjObCiqzWQCnlDSOadJZ.', '', '2024-10-17 13:55:27');
INSERT INTO `users` VALUES (3, '222', '$2a$10$.UVSP3a0c0qtLJpsEDecr.7QlW90pfsfaVCx27l4C10hbmSio9q3m', '222', '2024-10-17 13:56:08');
INSERT INTO `users` VALUES (4, 'admin', '$2a$10$l7G/O7IjIGlbxSY/q0r97./xdETicVB2.L8jrQYBHqaThZGkyxn0q', '164', '2024-10-17 14:01:56');
INSERT INTO `users` VALUES (5, 'zzc', '$2a$10$0oNoQlIosRYwgobqYhyvJ.k.X9I77nq0Nhw1xZw38CUmqmHVWuCfq', '78', '2024-10-17 14:03:54');
INSERT INTO `users` VALUES (6, '123', '$2a$10$nCnkTRaHLeZJLbnLyAxe4.B5/nosb7USMM15wjtrVutoYFDXz8gs.', '51587844@QQ.COM', '2024-10-20 12:18:32');
INSERT INTO `users` VALUES (20, 'cara', '$2a$10$4ZVt3w008XUii7LLiaa/R.0XqO/UqhOD0FOSmfN7m01Na13Pwd8cy', '165@163.com', '2026-09-24 08:16:20');
INSERT INTO `users` VALUES (21, 'test', '$2a$10$Yj/9z/ko6Iux.hK66uzdi.DbogxUAT8OOx8ifor4s1JeTL6w.PMne', 'jokeroq.77@gmail.com', '2026-10-12 01:10:05');

SET FOREIGN_KEY_CHECKS = 1;
