"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeTeamName = void 0;
var sanitizeTeamName = function (name) {
    return name.replace(/(ФК|ЛФК|ПФК|FC|AFC)/gi, '');
};
exports.sanitizeTeamName = sanitizeTeamName;
