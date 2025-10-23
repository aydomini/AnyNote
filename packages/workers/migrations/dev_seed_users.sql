-- 开发环境测试数据：创建虚假用户
-- 注意：仅用于本地开发测试，不要在生产环境执行！

-- 清空现有数据（可选，如果需要重新生成）
-- DELETE FROM users;
-- DELETE FROM notes;
-- DELETE FROM passwords;
-- DELETE FROM devices;

-- 插入 5 个测试用户
-- 密码：所有用户都使用 "TestPassword123!"（实际上这些 auth_hash 和 salt 是随机生成的，无法真正登录）

INSERT INTO users (id, email, auth_hash, salt, created_at, updated_at) VALUES
-- 用户1：Alice（技术博主）
('user-001-alice', 'alice@example.com', 'hash_alice_auth_123456789abcdef', 'salt_alice_random_xyz', 1704067200000, 1704067200000),

-- 用户2：Bob（产品经理）
('user-002-bob', 'bob@example.com', 'hash_bob_auth_987654321fedcba', 'salt_bob_random_abc', 1704153600000, 1704153600000),

-- 用户3：Carol（设计师）
('user-003-carol', 'carol@example.com', 'hash_carol_auth_abcdef123456789', 'salt_carol_random_def', 1704240000000, 1704240000000),

-- 用户4：David（学生）
('user-004-david', 'david@example.com', 'hash_david_auth_fedcba987654321', 'salt_david_random_ghi', 1704326400000, 1704326400000),

-- 用户5：Eve（自由职业者）
('user-005-eve', 'eve@example.com', 'hash_eve_auth_1a2b3c4d5e6f7g8h', 'salt_eve_random_jkl', 1704412800000, 1704412800000);

-- 为每个用户添加一些笔记
INSERT INTO notes (id, user_id, title, encrypted_content, iv, created_at, updated_at, version) VALUES
-- Alice 的笔记（3条）
('note-001-alice-1', 'user-001-alice', '技术博客写作计划', 'encrypted_content_alice_1', 'iv_alice_1', 1704067200000, 1704067200000, 1),
('note-002-alice-2', 'user-001-alice', 'React 最佳实践', 'encrypted_content_alice_2', 'iv_alice_2', 1704153600000, 1704153600000, 1),
('note-003-alice-3', 'user-001-alice', 'TypeScript 高级技巧', 'encrypted_content_alice_3', 'iv_alice_3', 1704240000000, 1704240000000, 1),

-- Bob 的笔记（2条）
('note-004-bob-1', 'user-002-bob', '产品需求文档', 'encrypted_content_bob_1', 'iv_bob_1', 1704153600000, 1704153600000, 1),
('note-005-bob-2', 'user-002-bob', '用户访谈记录', 'encrypted_content_bob_2', 'iv_bob_2', 1704240000000, 1704240000000, 1),

-- Carol 的笔记（4条）
('note-006-carol-1', 'user-003-carol', 'UI 设计灵感', 'encrypted_content_carol_1', 'iv_carol_1', 1704240000000, 1704240000000, 1),
('note-007-carol-2', 'user-003-carol', '配色方案收藏', 'encrypted_content_carol_2', 'iv_carol_2', 1704326400000, 1704326400000, 1),
('note-008-carol-3', 'user-003-carol', 'Figma 组件库', 'encrypted_content_carol_3', 'iv_carol_3', 1704412800000, 1704412800000, 1),
('note-009-carol-4', 'user-003-carol', '动画效果参考', 'encrypted_content_carol_4', 'iv_carol_4', 1704499200000, 1704499200000, 1),

-- David 的笔记（1条）
('note-010-david-1', 'user-004-david', '学习笔记：数据结构', 'encrypted_content_david_1', 'iv_david_1', 1704326400000, 1704326400000, 1),

-- Eve 的笔记（5条）
('note-011-eve-1', 'user-005-eve', '项目A需求整理', 'encrypted_content_eve_1', 'iv_eve_1', 1704412800000, 1704412800000, 1),
('note-012-eve-2', 'user-005-eve', '客户沟通记录', 'encrypted_content_eve_2', 'iv_eve_2', 1704499200000, 1704499200000, 1),
('note-013-eve-3', 'user-005-eve', '财务报表', 'encrypted_content_eve_3', 'iv_eve_3', 1704585600000, 1704585600000, 1),
('note-014-eve-4', 'user-005-eve', '技术选型对比', 'encrypted_content_eve_4', 'iv_eve_4', 1704672000000, 1704672000000, 1),
('note-015-eve-5', 'user-005-eve', '待办事项清单', 'encrypted_content_eve_5', 'iv_eve_5', 1704758400000, 1704758400000, 1);

-- 为每个用户添加一些密码记录
INSERT INTO passwords (id, user_id, encrypted_site, encrypted_username, encrypted_password, encrypted_notes, iv, created_at, updated_at, version) VALUES
-- Alice 的密码（2条）
('pwd-001-alice-1', 'user-001-alice', 'enc_github', 'enc_alice', 'enc_pwd_1', 'enc_note_1', 'iv_pwd_alice_1', 1704067200000, 1704067200000, 1),
('pwd-002-alice-2', 'user-001-alice', 'enc_aws', 'enc_alice', 'enc_pwd_2', 'enc_note_2', 'iv_pwd_alice_2', 1704153600000, 1704153600000, 1),

-- Bob 的密码（1条）
('pwd-003-bob-1', 'user-002-bob', 'enc_jira', 'enc_bob', 'enc_pwd_3', 'enc_note_3', 'iv_pwd_bob_1', 1704153600000, 1704153600000, 1),

-- Carol 的密码（3条）
('pwd-004-carol-1', 'user-003-carol', 'enc_dribbble', 'enc_carol', 'enc_pwd_4', 'enc_note_4', 'iv_pwd_carol_1', 1704240000000, 1704240000000, 1),
('pwd-005-carol-2', 'user-003-carol', 'enc_behance', 'enc_carol', 'enc_pwd_5', 'enc_note_5', 'iv_pwd_carol_2', 1704326400000, 1704326400000, 1),
('pwd-006-carol-3', 'user-003-carol', 'enc_figma', 'enc_carol', 'enc_pwd_6', 'enc_note_6', 'iv_pwd_carol_3', 1704412800000, 1704412800000, 1),

-- David 的密码（0条，新手用户）

-- Eve 的密码（4条）
('pwd-007-eve-1', 'user-005-eve', 'enc_stripe', 'enc_eve', 'enc_pwd_7', 'enc_note_7', 'iv_pwd_eve_1', 1704412800000, 1704412800000, 1),
('pwd-008-eve-2', 'user-005-eve', 'enc_paypal', 'enc_eve', 'enc_pwd_8', 'enc_note_8', 'iv_pwd_eve_2', 1704499200000, 1704499200000, 1),
('pwd-009-eve-3', 'user-005-eve', 'enc_cloudflare', 'enc_eve', 'enc_pwd_9', 'enc_note_9', 'iv_pwd_eve_3', 1704585600000, 1704585600000, 1),
('pwd-010-eve-4', 'user-005-eve', 'enc_netlify', 'enc_eve', 'enc_pwd_10', 'enc_note_10', 'iv_pwd_eve_4', 1704672000000, 1704672000000, 1);

-- 显示统计信息
SELECT '========== 测试数据统计 ==========' as info;
SELECT '用户数量：' as type, COUNT(*) as count FROM users;
SELECT '笔记数量：' as type, COUNT(*) as count FROM notes;
SELECT '密码数量：' as type, COUNT(*) as count FROM passwords;
