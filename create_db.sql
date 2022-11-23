--
-- File generated with SQLiteStudio v3.4.0 on Thu Nov 17 15:38:40 2022
--
-- Text encoding used: System
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: channels
CREATE TABLE IF NOT EXISTS channels (t_channel_name TEXT PRIMARY KEY NOT NULL UNIQUE);

-- Table: handles
CREATE TABLE IF NOT EXISTS handles (t_channel_name TEXT REFERENCES channels (t_channel_name) NOT NULL, t_handle_name TEXT NOT NULL);

-- Table: modules
CREATE TABLE IF NOT EXISTS modules (t_channel_name TEXT REFERENCES channels (t_channel_name) NOT NULL, t_module_name TEXT NOT NULL);

-- Table: openai_apikeys
CREATE TABLE IF NOT EXISTS openai_apikeys (t_nick TEXT PRIMARY KEY NOT NULL UNIQUE, t_key  TEXT NOT NULL);

COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
