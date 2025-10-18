/**
 * @typedef FileStream
 * @property {function(string):string|null} read
 * @property {function(string, string):string} write
 * @property {function(string): boolean} remove
 * 
 * @typedef Api
 * @property {function(string, string): boolean} replyRoom
 */

const prefix = '.'; // 명령어 접두사
const Admin_Room = 1234567890; // 관리방 이름

const defaultNotiOn = false; // 알림 기본값

/**
 * Module DBManager_deploy | AGPL-3.0 License
 * @see https://github.com/NyangBotLab/DBManager_deploy
 * @author saroro1
 */
// const DB = require('./modules/DBManager').DBManager;
const DB = require('DBManager_deploy-2/modules/DBManager').DBManager;
var DBListener = DB.getInstance({ reactByMine: true });

const chatManager = DB.utils;

const admin = [
    '1234567890', // 관리자 유저 아이디
];

const ify = (obj, num) => JSON.stringify(obj, null, num || 4);
const Lw = '\u200b'.repeat(500);

const TIME_FORMAT = 'Y년 MM월 dd일 HH시 mm분 ss초';
const T = (ts) => java.text.SimpleDateFormat(TIME_FORMAT).format(ts * 1000);
const T_D = (ts) => {
    let now = Date.now() / 1000 | 0;
    let sec = now - ts;
    if (sec < 60) return sec + '초 전';
    let min = sec / 60 | 0;
    if (min < 60) return min + '분 ' + (sec % 60) + '초 전';
    let hour = min / 60 | 0;
    if (hour < 24) return hour + '시간 ' + (min % 60) + '분 전';
    let day = hour / 24 | 0;
    return day + '일 ' + (hour % 24) + '시간 전';
}


/** @type {FileStream} */
const fs = FileStream;
const path = {
    enter: '/sdcard/DB/enter.txt', // 입퇴장
    del: '/sdcard/DB/del.txt', // 삭제
    memo: '/sdcard/DB/memo.txt', // 메모
    jamsu: '/sdcard/DB/jamsu.txt', // 잠수
    codes: '/sdcard/DB/codes.txt', // 코드
    notis: '/sdcard/DB/notis.txt', // 알림
    cmd: '/sdcard/DB/cmd.txt', // 명령어
};

if (!fs.read(path.cmd)) fs.write(path.cmd, '');
if (!fs.read(path.enter)) fs.write(path.enter, '{}');
if (!fs.read(path.del)) fs.write(path.del, '{}');
if (!fs.read(path.memo)) fs.write(path.memo, '{}');
if (!fs.read(path.jamsu)) fs.write(path.jamsu, '{}');
if (!fs.read(path.notis)) fs.write(path.notis, '{}');

const enters = JSON.parse(fs.read(path.enter));
const dels = JSON.parse(fs.read(path.del));
const memos = JSON.parse(fs.read(path.memo));
const jamsus = JSON.parse(fs.read(path.jamsu));
const notis = JSON.parse(fs.read(path.notis));
let jamsu_n = 0;

let nogroup_chat = {};

/** @type {Api} */
const api = Api;

/** @type {{ userId: { code: string, change: number } }} */
const CODES = JSON.parse(fs.read(path.codes) || '{}');

/** 알림바 왔을 떄 채널리스트 추가하기 */
function onNotificationPosted(sbn) {
    DBListener.addChannel(sbn);
}

/** 컴파일시 자동 종료 */
function onStartCompile() {
    DBListener.stop();
}

DBListener.start();

DBListener.on("message", (chat, channel) => {

    if (!channel || !chat) return;
    let user = chat.user;
    if (!channel.id || !user.name) return;

    if (!chat.text.startsWith(prefix)) channel.read();

    if (chat.text.startsWith('d ')) {

        if (!admin.includes(user.id)) return;
        try {
            // let r = null, ru = null;
            if (chat.isReply()) {
                // r = chat.source;
                // ru = chatManager.getNextChatByID(r.id);
                // ru = r.getNextChat();
            }
            let v = eval(chat.text.slice(2));
            if (v === '') v = '""';
            channel.send(String(v) || '""');
        } catch (e) {
            channel.send(e);
        }
    }

    if (!channel.isGroupChannel()) {
        if (!nogroup_chat[user.id]) {
            nogroup_chat[user.id] = 1;
            return;
        }
        if (nogroup_chat[user.id] > 1) {
            return;
        }
        nogroup_chat[user.id]++;
        channel.send([
            '[진우봇_안내]',
            '',
            '관리자 도움이 필요하신 경우, example 로 연락주세요. 1:1 채팅방에서는 답변을 드릴 수 없습니다.',
            '',
            '진우봇 홈페이지 example.com',
        ].join('\n'));
    }

    if (chat.text == prefix + '명령어' || chat.text == prefix + '도움말') {
        if (!fs.read(path.cmd)) {
            channel.send('명령어파일이 손상되었거나 파일이 없습니다.\n진우봇 관리자에게 문의하세요.');
            return;
        }
        channel.send('진우봇 명령어 입니다.' + Lw + '\n\n' + fs.read(path.cmd));

    }

    if (!channel.isGroupChannel()) return;


    // enters init
    if (!enters[channel.id]) enters[channel.id] = {
        on: true,
        enter: [],
        exit: [],
        list: [],
    };
    // dels init
    if (!dels[channel.id]) dels[channel.id] = {
        code: 1,
        list: [],
    };
    // memos init
    if (!memos[channel.id]) memos[channel.id] = {
        on: true,
        vals: {},
    };
    // jamsu init
    if (!jamsus[channel.id]) jamsus[channel.id] = {};
    jamsus[channel.id][user.id] = Date.now() / 1000 | 0; // 잠수 갱신
    if (++jamsu_n > 10) {
        jamsu_n = 0;
        fs.write(path.jamsu, ify(jamsus));
    }
    // CODES init
    if (!CODES[channel.id]) {
        CODES[channel.id] = {};
        CODES[channel.id].code = generateCode(channel.id);
        CODES[channel.id].name = channel.name;
    }
    if (!CODES[channel.id][user.id]) {
        CODES[channel.id][user.id] = {
            code: generateCode(channel.id),
            change: 0,
        };
        fs.write(path.codes, ify(CODES));
    }
    if (CODES[channel.id].name != channel.name) {
        CODES[channel.id].name = channel.name;
        fs.write(path.codes, ify(CODES));
    }
    // notis init
    if (!notis[channel.id]) notis[channel.id] = {};
    if (!notis[channel.id][user.id]) notis[channel.id][user.id] = {
        on: defaultNotiOn,
        list: [],
    };

    // noti check
    if (notis[channel.id][user.id].list.length > 0) {
        let replies = notis[channel.id][user.id].list.filter(v => v.type === 'reply');
        let mentions = notis[channel.id][user.id].list.filter(v => v.type === 'mention');
        if (notis[channel.id][user.id].on)
            channel.send(user.name + '님에게 총 ' + (replies.length + mentions.length) + '개의 알림이 있습니다.\n'
                + '멘션: ' + mentions.length + '회\n답장: ' + replies.length + '회' + Lw
                + '\n\n\n' + (mentions.length > 0 ? mentions.map(e => chatManager.getOneUserByID(e.id).name + '님이 멘션 하였습니다\n메시지내용:' + e.content + '\n' + T(e.ts) + ' (' + T_D(e.ts) + ')').join('\n\n') + '\n\n\n' : '')
                + replies.map(e => chatManager.getOneUserByID(e.id).name + '님이 답장 하였습니다\n메시지내용: ' + e.replyContent + '\n답장내용:' + e.content + '\n' + T(e.ts) + ' (' + T_D(e.ts) + ')').join('\n\n'));
        notis[channel.id][user.id].list = [];
        fs.write(path.notis, ify(notis));
    }


    if (chat.isReply()) {
        if (chat.source.user.id == 402907117) { // 봇한테 답장
            if (channel.name !== Admin_Room)
                channel.get(Admin_Room).send('[call message]\n방이름 : ' + channel.name + '(' + CODES[channel.id].code + ')' + Lw
                    + '\n유저이름 : ' + user.name + '(' + CODES[channel.id][user.id].code + ')'
                    + '\n원본 메시지 : ' + chat.text
                    + '\n답장 메시지 : ' + chat.source.text)
        } else {
            if (chat.source.user.id !== chat.user.id) {
                if (!notis[channel.id][chat.source.user.id]) notis[channel.id][chat.source.user.id] = {
                    on: defaultNotiOn,
                    list: [],
                };
                notis[channel.id][chat.source.user.id].list.push({
                    type: 'reply',
                    id: user.id,
                    content: chat.text,
                    replyContent: chat.source.text,
                    ts: Date.now() / 1000 | 0,
                });
                fs.write(path.notis, ify(notis));
            }
        }
    } else if (chat.attachment.mentions !== undefined) {
        let ids = channel.members.map(e => e.id);
        (chat.attachment.mentions).forEach(mention => {
            if (!ids.includes(String(mention.user_id))) { // 봇 멘션
                if (channel.name !== Admin_Room)
                    channel.get(Admin_Room).send('[call message]\n방이름 : ' + channel.name + '(' + CODES[channel.id].code + ')' + Lw
                        + '\n유저이름 : ' + user.name + '(' + CODES[channel.id][user.id].code + ')'
                        + '\n메시지 : ' + chat.text)
            } else {
                if (mention.user_id !== chat.user.id) {
                    if (!notis[channel.id][mention.user_id]) notis[channel.id][mention.user_id] = {
                        on: defaultNotiOn,
                        list: [],
                    };
                    notis[channel.id][mention.user_id].list.push({
                        type: 'mention',
                        id: user.id,
                        content: chat.text,
                        ts: Date.now() / 1000 | 0,
                    });
                    fs.write(path.notis, ify(notis));
                }
            }
        });
    }

    if (chat.text == prefix + '읽은사람') {
        if (![1, 4].includes(user.memberType)) return channel.send('방장, 부방장만 사용 가능한 키워드입니다.');
        if (!chat.isReply()) return channel.send('답장을 사용해주세요.');
        channel.send('답장하신 메시지를 읽은사람 목록 입니다.' + Lw + '\n\n총 ' + chat.source.readMembers.map(e => e.name).length + '명 읽음\n\n' + chat.source.readMembers.map(e => e.name).join("\n"));
    }

    if (chat.text === prefix + '알림끄기') {
        notis[channel.id][user.id].on = false;
        fs.write(path.notis, ify(notis));
        channel.send('해당 방의 알림을 껐습니다.');
    }
    if (chat.text === prefix + '알림켜기') {
        notis[channel.id][user.id].on = true;
        fs.write(path.notis, ify(notis));
        channel.send('해당 방의 알림을 켰습니다.');
    }


    if (chat.text === prefix + '__아이디') {
        if (chat.isReply()) channel.send(chat.source.user.name + '님의 아이디: ' + chat.source.user.id);
        else channel.send(user.name + '님의 아이디: ' + user.id);
    }


    if (chat.text === prefix + '코드') {
        if (chat.isReply()) {
            if (!CODES[channel.id][chat.source.user.id]) {
                CODES[channel.id][chat.source.user.id] = {
                    code: generateCode(channel.id),
                    change: 0,
                };
                fs.write(path.codes, ify(CODES));
            }
            channel.send(chat.source.user.name + '님의 코드: ' + CODES[channel.id][chat.source.user.id].code);
        } else channel.send(user.name + '님의 코드: ' + CODES[channel.id][user.id].code + '\n' + prefix + '코드 [변경할 코드] 로 단 한 번만 변경 가능합니다.');
    }

    if (chat.text.startsWith(prefix + '코드 ')) {
        if (CODES[channel.id][user.id].change > 0) return channel.send('코드를 이미 변경하셨습니다.');
        let code = chat.text.slice(4).trim().toUpperCase();
        if (!code.match(/^[A-Z]{6}$/)) return channel.send('코드는 영문 대문자 6자리여야 합니다. 예시: WASANS');
        if (code === CODES[channel.id][user.id].code) return channel.send('현재 코드와 같습니다.');
        let uids = Object.keys(CODES[channel.id]);
        let u = uids.find(uid => CODES[channel.id][uid].code === code);
        if (u) return channel.send('이미 ' + chatManager.getOneUserByID(u).name + '님이 사용중인 코드입니다.');
        CODES[channel.id][user.id].code = code;
        CODES[channel.id][user.id].change++;
        channel.send('코드가 변경되었습니다.\n' + code);
        fs.write(path.codes, ify(CODES));
    }

    if (chat.text === prefix + '방목록') {
        if (![1, 4].includes(user.memberType)) return channel.send('방장, 부방장만 사용 가능한 키워드입니다.');
        channel.send(Object.keys(CODES).filter(e => CODES[e].name).map(e => CODES[e].name + '\n코드: ' + CODES[e].code).join('\n----------\n'));
    }

    if (chat.text.startsWith(prefix + '답장 ')) {
        // if (channel.name !== Admin_Room) return;
        if (!admin.includes(user.id)) return;
        let id = chat.text.split(' ')[1].toUpperCase();
        let msg = chat.text.slice(5 + id.length);
        let chan = Object.keys(CODES).find(e => CODES[e].code === id);
        if (!chan) return channel.send('존재하지 않는 코드입니다.');
        api.replyRoom(CODES[chan].name, '[' + user.name + '님의 답장]\n' + msg);
    }

    // 밑메
    if (chat.text.startsWith(prefix + '밑메')) {
        let code = dels[channel.id].code; // 삭메/밑메 표시여부 코드
        if (code === 0 && user.memberType !== 1) return channel.send('방장만 사용 가능한 키워드입니다.');
        if (code === 1 && user.memberType === 2) return channel.send('방장, 부방장만 사용 가능한 키워드입니다.');
        if (!chat.isReply()) return channel.send('답장으로만 사용이 가능합니다.');
        let num = parseInt(chat.text.slice(3) || 1);
        if (num > 10) return channel.send('10개 이상은 불가능합니다.');
        if (chat.source === null) return channel.send('메시지 탐색 범위를 벗어났습니다.');
        let v = msgFormat(chat.source.getNextChat(num));
        if (String(v) === '[object Object]') return channel.send('가려진 메시지입니다.');
        channel.send(v);
        // channel.send('원본' + Lw + ify(current.raw));
    }

    // 삭메
    if (chat.text === prefix + '삭메') {
        // memberType: 1: 방장, 4: 부방장, 2: 일반
        let code = dels[channel.id].code;
        if (code === 0 && user.memberType !== 1) return channel.send('방장만 사용 가능한 키워드입니다.');
        if (code === 1 && user.memberType === 2) return channel.send('방장, 부방장만 사용 가능한 키워드입니다.');
        if (dels[channel.id].list.length === 0) return channel.send('삭제된 메시지가 없습니다.');
        channel.send(dels[channel.id].list.slice(0, 3).map(e => {
            return '[' + T(e.time) + ']\n' + chatManager.getOneUserByID(e.id).name + ': ' + e.text;
        }).join('\n\n'));
    }

    if (chat.text.startsWith(prefix + '삭메 ')) {
        if (user.memberType !== 1) return channel.send('방장만 사용 가능한 키워드입니다.');
        let code = +chat.text.slice(3).trim();
        if (![0, 1, 2, 3].includes(code)) return channel.send('코드:\n0: 방장외에는 사용 불가\n1: 방장, 부방까지 사용 (기본값)\n2: 전체 사용');
        if (code === 3) return;
        dels[channel.id].code = code;
        fs.write(path.del, JSON.stringify(dels));
        channel.send('방의 삭메 코드를 ' + code + '로 변경하였습니다.');
    }


    // 입퇴장 목록
    if (chat.text === prefix + '입장') {
        channel.send(channel.name + ' 채팅방 입장 목록' + Lw + '\n\n\n' + (enters[channel.id].enter.map(e => {
            if (!CODES[channel.id][e.id]) CODES[channel.id][e.id] = {
                code: generateCode(channel.id),
                change: 0,
            };
            return '[' + T(e.time) + ']\n' + chatManager.getOneUserByID(e.id).name + '[' + CODES[channel.id][e.id].code + ']님이 입장하셨습니다.';
        }).join('\n\n') || '입장한 사람이 없습니다.'));
    }
    if (chat.text === prefix + '퇴장') {
        try {
            channel.send(channel.name + ' 채팅방 퇴장 목록' + Lw + '\n\n\n' + (enters[channel.id].exit.map(e => {
                if (!CODES[channel.id][e.id]) CODES[channel.id][e.id] = {
                    code: generateCode(channel.id),
                    change: 0,
                };
                if (e.kickedBy && !CODES[channel.id][e.kickedBy]) CODES[channel.id][e.kickedBy] = {
                    code: generateCode(channel.id),
                    change: 0,
                };
                return '[' + T(e.time) + ']\n' + chatManager.getOneUserByID(e.id).name + '[' + CODES[channel.id][e.id].code + ']님이 ' + (e.kickedBy ? (chatManager.getOneUserByID(e.kickedBy).name + '[' + CODES[channel.id][e.kickedBy].code + ']님에 의해 강제 퇴장 당') : '퇴장') + '하셨습니다.';
            }).join('\n\n') || '퇴장한 사람이 없습니다.'));
        } catch (e) {
            channel.send("[오류 발생] 관리자에게 아래 내용을 전달해주세요.\n" + e)
        }
    }

    if (chat.text === prefix + '입퇴장') {
        channel.send(channel.name + ' 채팅방 입퇴장 목록' + Lw + '\n\n\n' + (enters[channel.id].list.map(e => {
            if (!CODES[channel.id][e.id]) CODES[channel.id][e.id] = {
                code: generateCode(channel.id),
                change: 0,
            };
            if (e.kickedBy && !CODES[channel.id][e.kickedBy]) CODES[channel.id][e.kickedBy] = {
                code: generateCode(channel.id),
                change: 0,
            };
            return '[' + T(e.time) + ']\n'
                + chatManager.getOneUserByID(e.id).name + '[' + CODES[channel.id][e.id].code + ']님이 ' + (e.type === 'enter' ? '입장' : (e.kickedBy ? (chatManager.getOneUserByID(e.kickedBy).name + '[' + CODES[channel.id][e.kickedBy].code + ']님에 의해 강제 퇴장 당') : '퇴장')) + '하셨습니다.';
        }).join('\n\n') || '입퇴장 기록이 없습니다.'));
    }

    if (chat.text.startsWith(prefix + '입퇴장 @')) {
        if (!chat.attachment) return channel.send('사용법: ' + prefix + '입퇴장 @유저');
        let list = enters[channel.id].list;
        chat.attachment.mentions.forEach(e => {
            let id = e.user_id;
            channel.send(channel.name + ' 채팅방 ' + chatManager.getOneUserByID(id).name + '님의 입퇴장 목록' + Lw + '\n\n\n' + (list.filter(e => e.id === id).map(e => {
                return '[' + T(e.time) + ']\n'
                    + chatManager.getOneUserByID(e.id).name + '[' + CODES[channel.id][e.id].code + '님이 ' + (e.type === 'enter' ? '입장' : (e.kickedBy ? (chatManager.getOneUserByID(e.kickedBy).name + '님에 의해 강제 퇴장 당') : '퇴장')) + '하셨습니다.';
            }).join('\n\n') || '입퇴장 기록이 없습니다.'));
        });
        return;
    }

    // 입퇴장 켜기/끄기
    if (chat.text.startsWith(prefix + '입퇴장')) {
        if (['켜기', '끄기'].includes(chat.text.slice(4).trim())) {
            if (user.memberType !== 1) return channel.send('방장만 사용 가능한 키워드입니다.');
            let on = chat.text.slice(5).trim() === '켜기';
            enters[channel.id].on = on;
            fs.write(path.enter, JSON.stringify(enters));
            channel.send('입퇴장 알림을 ' + (on ? '켰습니다.' : '껐습니다.'));
        }
    }

    if (chat.text === prefix + '입퇴장 초기화') {
        if (user.memberType !== 1) return channel.send('방장만 사용 가능한 키워드입니다.');
        if (!this.confirm) {
            this.confirm = true;
            channel.send('정말로 초기화하시겠습니까? 초기화를 원하시면 다시 한번 입력해주세요.');
            setTimeout(() => {
                this.confirm = false;
                channel.send('초기화가 취소되었습니다.');
            }, 10000);
            return;
        }
        enters[channel.id].enter = [];
        enters[channel.id].exit = [];
        enters[channel.id].list = [];
        fs.write(path.enter, JSON.stringify(enters));
        channel.send('입퇴장 목록을 초기화하였습니다.');
    }

    if (chat.text.startsWith(prefix + '메모')) {
        if (!chat.isReply()) return channel.send('답장을 사용해주세요.');
        let s = chat.source;
        if (!s.text.includes('감지]') && !s.text.includes('코드: ')) return channel.send('입퇴장 메시지에 답장을 사용해주세요.');
        if (![1, 4].includes(user.memberType)) return channel.send('방장, 부방장만 사용 가능한 키워드입니다.');
        let memo = chat.text.slice(4).trim();
        if (memo === '') return channel.send('메모를 입력해주세요.');
        let code = s.text.match(/코드: ([A-Z]+)/)[1];
        memos[channel.id].vals[code] = memo;
        fs.write(path.memo, JSON.stringify(memos));
        channel.send('메모를 저장하였습니다.');
    }

    if (chat.text === prefix + '잠수') {
        // 1주 잠수만 필터링
        let list = Object.keys(jamsus[channel.id]).filter(e => jamsus[channel.id][e] + 604800 < Date.now() / 1000);
        channel.send('잠수 목록' + Lw + '\n\n\n' + (list.map(e => {
            return chatManager.getOneUserByID(e).name + ': ' + ((Date.now() - jamsus[channel.id][e] * 1000) / 1000 / 60 / 60 / 24).toFixed(1) + '일';
        }).join('\n\n') || '잠수한 유저가 없습니다.'));
    }
});

/**
 * 
 * @param {import('./modules/DBManager/index').Chat} chat 
 */
function msgFormat(chat) {
    let a;
    if (chat.isPhoto()) return '[사진]';
    if (chat.isMultiPhoto()) return '[묶은사진]';
    if (chat.isVideo()) return '[동영상]';
    if (chat.isAudio()) return '[파일]';
    if (chat.isEmoticon()) {
        if (chat.text === '') return '[이모티콘]';
        return '[이모티콘]\n' + chat.text;
    }
    if (chat.isReply()) {
        a = '[' + chat.source.user.name + '님에게 답장]';
    }
    if (a) return a + ' ' + chat.text;
    if (typeof chat.text !== 'string') return '[정보 없음]';
    return chat.text;
}
/*
function msgFormat(chat) {
   let a;
   if (chat.isPhoto()) return '[사진] ' + chat.photo.url;
   if (chat.isMultiPhoto()) return '[사진]\n' + chat.photoList.imageUrls.map((e, i) => '[' + ++i + '] ' + e).join('\n');
   if (chat.isVideo()) return '[동영상] ' + chat.video.url;
   if (chat.isAudio()) return '[파일] ' + chat.audio.url;
   if (chat.isEmoticon()) {
       let url = 'item.kakaocdn.net/dw/' + chat.emoticon.path.replace('emot', 'thum').replace('webp', 'png');
       if (chat.text === '') return '[이모티콘: ' + url + ']';
       return '[이모티콘: ' + url + '] ' + chat.text;
   }
   // if (chat.is)
   if (chat.isReply()) {
       a = '[' + chat.source.user.name + '님에게 답장]';
   }
   if (a) return a + ' ' + chat.text;
   if (typeof chat.text !== 'string') return '[가린 메시지는 볼 수 없습니다.]';
   return chat.text;
}
*/

function generateCode(channelID) {
    // 6 random uppercase alphabet
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }
    if (Object.keys(CODES[channelID]).map(uid => CODES[channelID][uid].code).includes(code))
        return generateCode(channelID);
    return code;
}

/**
 * 오픈채팅에 들어왔을 때 반응
 */
DBListener.on("join", (chat, channel) => {
    if (channel === null) return;
    let user = chat.joinUsers[0];
    if (!CODES[channel.id]) CODES[channel.id] = {};
    if (!CODES[channel.id][user.userId]) {
        CODES[channel.id][user.userId] = {
            code: generateCode(channel.id),
            change: 0,
        };
        fs.write(path.codes, JSON.stringify(CODES));
    }
    if (enters[channel.id].on) {
        let lastThingies = enters[channel.id].list.filter(e => e.id === user.userId);
        if (lastThingies.length !== 0) {
            channel.send('[입장감지]\n' + user.nickName + '님의 ' + (lastThingies.filter(e => e.type === 'enter').length + 1)
                + '번째 입장입니다.' + Lw + '\n코드: ' + CODES[channel.id][user.userId].code + '\n마지막 퇴장: ' + T(lastThingies[0].time)
                + (memos[channel.id].vals[CODES[channel.id][user.userId].code] ? '\n메모: ' + memos[channel.id].vals[CODES[channel.id][user.userId].code] : Lw + '\n\n[메모기능]\n방장/부방장은 이 메시지에 ' + prefix + '메모 [내용]으로 입퇴장 상황등을 저장할수 있습니다.\n예시: ' + prefix + '메모 들낙'));
            delete memos[channel.id].vals[CODES[channel.id][user.userId].code];
            fs.write(path.memo, JSON.stringify(memos));
        }
        else channel.send('[입장감지]\n' + user.nickName + "님의 첫번째 입장 입니다.\n코드: " + CODES[channel.id][user.userId].code);
    }
    if (!enters[channel.id].enter.find(e => e.id === user.userId)) enters[channel.id].enter.unshift({
        id: user.userId,
        time: Date.now() / 1000 | 0,
    });
    enters[channel.id].list.unshift({
        type: 'enter',
        id: user.userId,
        time: Date.now() / 1000 | 0,
    });
    if (enters[channel.id].exit.find(e => e.id === user.userId))
        enters[channel.id].exit.splice(enters[channel.id].exit.findIndex(e => e.id === user.userId), 1);
    fs.write(path.enter, JSON.stringify(enters, null, 4));

});

/**
 * 단체톡방에 초대했을 때 반응
*/
DBListener.on("invite", (chat, channel) => {
    if (channel === null) return;
    if (enters[channel.id].on) channel.send(chat.inviteUser.nickName + "님이 " + chat.invitedUsers.map((e) => e.nickName).join(",") + "님을 초대했습니다");
    chat.invitedUsers.forEach(user => {
        if (!enters[channel.id].enter.find(e => e.id === user.userId)) enters[channel.id].enter.unshift({
            id: user.userId,
            time: Date.now() / 1000 | 0,
        });
        enters[channel.id].list.unshift({
            type: 'enter',
            id: user.userId,
            time: Date.now() / 1000 | 0,
        });
        if (enters[channel.id].exit.find(e => e.id === user.userId))
            enters[channel.id].exit.splice(enters[channel.id].exit.findIndex(e => e.id === user.userId), 1);
    });
    fs.write(path.enter, JSON.stringify(enters, null, 4));
});

/**
 * 톡방에서 나갈 때
*/
DBListener.on("leave", (chat, channel) => {
    if (channel === null) return;
    try {
        let user = chat.leaveUser;
        if (!CODES[channel.id]) CODES[channel.id] = {};
        if (!CODES[channel.id][user.userId]) {
            CODES[channel.id][user.userId] = {
                code: generateCode(channel.id),
                change: 0,
            };
            fs.write(path.codes, JSON.stringify(CODES));
        }
        if (user.userId === '386901803') channel.send('[경고] 호준나감 ㅉㅈㅈㅈㅈㅈㅈㅈㅈㅈㅈㅈㅈㅈ');
        else if (enters[channel.id].on) {
            let lastThingies = enters[channel.id].list.filter(e => e.id === user.userId);
            if (lastThingies.length !== 0) {
                channel.send('[퇴장감지]\n' + user.nickName + '님의 ' + (lastThingies.filter(e => e.type === 'exit' || e.type === 'kick').length + 1)
                    + '번째 퇴장입니다.' + Lw + '\n코드: ' + CODES[channel.id][user.userId].code + '\n마지막 입장: ' + T(lastThingies[0].time)
                    + (memos[channel.id].vals[CODES[channel.id][user.userId].code] ? '\n메모: ' + memos[channel.id].vals[CODES[channel.id][user.userId].code] : Lw + '\n\n[메모기능]\n방장/부방장은 이 메시지에 ' + prefix + '메모 [내용]으로 입퇴장 상황등을 저장할수 있습니다.\n예시: ' + prefix + '메모 들낙'));
                delete memos[channel.id].vals[CODES[channel.id][user.userId].code];
            }
            else channel.send('[퇴장감지]\n' + user.nickName + "님이 퇴장하셨습니다.\n코드: " + CODES[channel.id][user.userId].code + Lw + '\n\n[메모기능]\n방장/부방장은 이 메시지에 ' + prefix + '메모 [내용]으로 입퇴장 상황등을 저장할수 있습니다.\n예시: ' + prefix + '메모 들낙');
        }

        if (!enters[channel.id].exit.find(e => e.id === user.userId)) enters[channel.id].exit.unshift({
            id: user.userId,
            name: user.nickName,
            time: Date.now() / 1000 | 0,
        });
        enters[channel.id].list.unshift({
            type: 'exit',
            id: user.userId,
            name: user.nickName,
            time: Date.now() / 1000 | 0,
        });
        if (enters[channel.id].list.length > 1000) enters[channel.id].list = enters[channel.id].list.slice(-1000);
        if (enters[channel.id].enter.find(e => e.id === user.userId))
            enters[channel.id].enter.splice(enters[channel.id].enter.findIndex(e => e.id === user.userId), 1);
        fs.write(path.enter, JSON.stringify(enters, null, 4));
    } catch (e) {
        channel.send('[오류 발생]\n' + e);
    }
});

/**
 * 톡방에서 강퇴 당할 때
*/
DBListener.on("kick", (chat, channel) => {
    if (channel === null) return;
    try {
        let user = chat.kickedUser;
        if (!CODES[channel.id]) CODES[channel.id] = {};
        if (!CODES[channel.id][user.userId]) {
            CODES[channel.id][user.userId] = {
                code: generateCode(channel.id),
                change: 0,
            };
            fs.write(path.codes, JSON.stringify(CODES));
        }
        if (enters[channel.id].on) {
            let lastThingies = enters[channel.id].list.filter(e => e.id === user.userId);
            if (lastThingies.length !== 0) {
                channel.send('[강퇴감지]\n' + user.nickName + "님이 " + chat.user.name + "님에 의해 강제 퇴장되셨습니다. (" + (lastThingies.filter(e => e.type === 'exit' || e.type === 'kick').length + 1)
                    + '번째 퇴장)' + Lw + '\n코드: ' + CODES[channel.id][user.userId].code + '\n마지막 입장: ' + T(lastThingies[0].time)
                    + (memos[channel.id].vals[CODES[channel.id][user.userId].code] ? '\n메모: ' + memos[channel.id].vals[CODES[channel.id][user.userId].code] : (Lw + '\n\n[메모기능]\n방장/부방장은 이 메시지에 ' + prefix + '메모 [내용]으로 입퇴장 상황등을 저장할수 있습니다.\n예시: ' + prefix + '메모 들낙')));
                delete memos[channel.id].vals[CODES[channel.id][user.userId].code];
            }
            else channel.send('[강퇴감지]\n' + user.nickName + "님이 " + chat.user.name + "님에 의해 강제 퇴장되셨습니다.\n코드: " + CODES[channel.id][user.userId].code);
        }
        enters[channel.id].exit.unshift({
            id: user.userId,
            name: user.nickName,
            kickedBy: chat.user.id,
            time: Date.now() / 1000 | 0,
        });
        enters[channel.id].list.unshift({
            type: 'kick',
            id: user.userId,
            name: user.nickName,
            kickedBy: chat.user.id,
            time: Date.now() / 1000 | 0,
        });
        if (enters[channel.id].enter.find(e => e.id === user.userId))
            enters[channel.id].enter.splice(enters[channel.id].enter.findIndex(e => e.id === user.userId), 1);
        fs.write(path.enter, JSON.stringify(enters, null, 4));
        //channel.send('[DEBUG] kick listener 실행끝');
    } catch (e) {
        channel.send('[오류 발생]\n' + e);
    }
});

/**
 * 누군가 메시지를 지웠을 때
 */
DBListener.on("delete", (chat, channel) => {
    if (channel === null) return;
    // channel.send(chat.deletedChat.text+ "메시지가 지워졌어요");
    let user = chat.user;
    if (!CODES[channel.id]) CODES[channel.id] = {};
    if (!CODES[channel.id][user.userId]) {
        CODES[channel.id][user.userId] = {
            code: generateCode(channel.id),
            change: 0,
        };
        fs.write(path.codes, JSON.stringify(CODES));
    }

    dels[channel.id].list.unshift({
        id: chat.user.id,
        text: msgFormat(chat.deletedChat),
        time: Date.now() / 1000 | 0,
    });
    if (dels[channel.id].list.length > 10) dels[channel.id].list.pop();
    fs.write(path.del, JSON.stringify(dels, null, 4));
});

/**
 * 방장이나 부방장이 메시지를 가렸을 때
 */
DBListener.on("hide", (chat, channel) => {
    // channel.send(chat.user.name+"님이 메시지를 가렸어요");
    // channel.send(ify(chat.raw));
});

/**
 * 권한이 바뀔 때
 */
DBListener.on("member_type_change", (chat, channel) => {
    if (chat.isDemote()) {
        channel.send(chat.demoteUser.nickName + "님이 부방장에서 내려왔어요.");
    }
    else if (chat.isPromote()) {
        channel.send(chat.promoteUser.nickName + "님이 부방장이 되었어요.");
    }
    if (chat.isHandover()) {
        channel.send(chat.newHost.nickName + "님이 방장이 되었어요.");
    }
});