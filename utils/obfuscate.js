const crypto = require('crypto');

exports.encodeBase64 = (str) => {
  return Buffer.from(str).toString('base64');
};

exports.decodeBase64 = (str) => {
  return Buffer.from(str, 'base64').toString();
};

exports.generateUserId = (username) => {
  return crypto
    .createHash('sha256')
    .update(username + Date.now())
    .digest('hex')
    .substring(0, 12);
};

exports.rot13 = (str) => {
  return str.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode(
      (c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
    );
  });
};

exports.xorEncrypt = (str, key) => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};
