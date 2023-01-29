const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
var iconv = require('iconv-lite');
const MongoClient = require('mongodb').MongoClient;

async function main() {
    const conn = await MongoClient.connect('mongodb://localhost:27017');
    const db = conn.db('event')
    const new_event_collection = db.collection('new_event');
    const all_data = await new_event_collection.find({}).toArray(); //현재 확인한 모든 event
    const prev_key = {}; // 이미 존재하는 key
    all_data.map((ele) => {
        prev_key[ele.key] = true;
    })
    const urls = [];
    const keyMap = {}; //현재 category에서 존재하는 key
    for (let i = 1; i < 10; i++) {
        for (let j = 1; j < 10000; j++) {
            const paginationURL = `http://www.playdb.co.kr/playdb/playdblist.asp?Page=${j}&sReqMainCategory=00000${i}&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1`;
            console.log(paginationURL)
            const pageHTML = await axios.get(paginationURL, { responseType: 'arraybuffer' });

            const detailMap = {};
            const content = iconv.decode(pageHTML.data, 'EUC-KR').toString()
            const $ = cheerio.load(content);

            // console.log(pageHTML.data);
            $('a').each((index, element) => {
                const tpaginationURL = $(element).attr('href');
                if (tpaginationURL.includes('#')) {
                    const detail = $(element).attr('onclick');
                    const detailKey = detail.match(/[0-9]+/)[0];
                    const context = $(element).text();
                    detailMap[detailKey] = context;
                }
            })
            let stopFlag = false;
            const newURLs = Object.keys(detailMap).map((key) => {
                if (prev_key[key]) {
                    return null;
                }
                if (!keyMap[key]) {
                    keyMap[key] = true;
                } else {
                    return null;
                }
                return { name: detailMap[key], key: key, url: `http://www.playdb.co.kr/playdb/playdbDetail.asp?sReqPlayno=${key}`, created_at: new Date() }
            }).filter((ele) => ele !== null)
            if (newURLs.length === 0) {
                break;
            }
            urls.push(...newURLs)
        }
    }
    if (urls.length !== 0) {
        await new_event_collection.insertMany(urls)
    }
    fs.writeFileSync(`new_${new Date().getTime()}.json`, JSON.stringify(urls))
}
main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });