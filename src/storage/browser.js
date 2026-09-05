import { DB_NAME, STORE_NAME } from './keys.js';

const browserDb = {
            conn: null,
            lastError: null,
            async open() {
                if (this.conn) return this.conn;
                return new Promise((resolve, reject) => {
                    const req = indexedDB.open(DB_NAME, 1);
                    req.onerror = () => reject('DB Error');
                    req.onsuccess = (e) => {
                        this.conn = e.target.result;
                        this.conn.onversionchange = () => { this.conn?.close(); this.conn = null; };
                        this.conn.onclose = () => { this.conn = null; };
                        resolve(this.conn);
                    };
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
                    };
                });
            },
            async put(id, data) {
                const conn = await this.open();
                return await new Promise((resolve, reject) => {
                    const tx = conn.transaction(STORE_NAME, 'readwrite');
                    tx.objectStore(STORE_NAME).put(data, String(id));
                    tx.oncomplete = () => resolve(data);
                    tx.onerror = () => reject(tx.error || new Error('写入浏览器图片存储失败'));
                    tx.onabort = () => reject(tx.error || new Error('浏览器图片写入事务已中止'));
                });
            },
            async get(id) {
                this.lastError = null;
                try {
                    const conn = await this.open();
                    return await new Promise((resolve) => {
                        let settled = false;
                        const done = (value) => { if (!settled) { settled = true; resolve(value ?? null); } };
                        try {
                            const tx = conn.transaction(STORE_NAME, 'readonly');
                            const req = tx.objectStore(STORE_NAME).get(String(id));
                            req.onsuccess = () => done(req.result);
                            req.onerror = () => { this.lastError = req.error || new Error('读取图片失败'); done(null); };
                            tx.onerror = () => { this.lastError = tx.error || new Error('读取图片事务失败'); done(null); };
                            tx.onabort = () => { this.lastError = tx.error || new Error('读取图片事务已中止'); done(null); };
                        } catch (error) {
                            this.conn = null;
                            this.lastError = error;
                            done(null);
                        }
                    });
                } catch(e) { this.lastError = e; return null; }
            },
            async delete(id) {
                const conn = await this.open();
                return await new Promise((resolve, reject) => {
                    const tx = conn.transaction(STORE_NAME, 'readwrite');
                    tx.objectStore(STORE_NAME).delete(String(id));
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error || new Error('删除浏览器图片失败'));
                    tx.onabort = () => reject(tx.error || new Error('浏览器图片删除事务已中止'));
                });
            },
            async clear() {
                const conn = await this.open();
                return await new Promise((resolve, reject) => {
                    const tx = conn.transaction(STORE_NAME, 'readwrite');
                    tx.objectStore(STORE_NAME).clear();
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error || new Error('清理浏览器图片失败'));
                    tx.onabort = () => reject(tx.error || new Error('浏览器图片清理事务已中止'));
                });
            }
        };

const writeBrowserMetadata = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn(`Unable to mirror metadata in localStorage: ${key}`, error);
            }
        };

export { browserDb, writeBrowserMetadata };
