'use strict';
const fs=require('node:fs'),path=require('node:path');
const bank=require('../questions');
fs.writeFileSync(path.join(__dirname,'../public/practice-bank.js'),'/* 배우기와 혼자 하기에서 사용하는 문제 자료. questions.js에서 만듭니다. */\nwindow.guardianPracticeBank = '+JSON.stringify(bank,null,2)+';\n');
console.log('개인 배움 문제 '+bank.length+'개 저장 완료');
