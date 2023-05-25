const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
var iconv = require('iconv-lite');
const MongoClient = require('mongodb').MongoClient;

async function main() {
    const conn = await MongoClient.connect('mongodb://localhost:27017');
    const db = conn.db('event')
    const new_artist_collection = db.collection('new_artist');
    const all_data = await new_artist_collection.find({}).toArray(); //현재 확인한 모든 event
    const prev_key = {}; // 이미 존재하는 key
    all_data.map((ele) => {
        prev_key[ele.key] = true;
    })
    const urls = [];
    const keyMap = {}; //현재 category에서 존재하는 key
    const artistMap = {};
    let lastEvent = '';
    for (let i = 1; i < 10; i++) {
        for (let j = 1; j < 10000; j++) {
            const paginationURL = `http://www.playdb.co.kr/playdb/playdblist.asp?Page=${j}&sReqMainCategory=00000${i}&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1`;
            const pageHTML = await axios.get(paginationURL, { responseType: 'arraybuffer' });

            const detailMap = {};
            const content = iconv.decode(pageHTML.data, 'EUC-KR').toString()
            const $ = cheerio.load(content);

            // console.log(pageHTML.data);
            $('a').each((index, element) => {
                const tpaginationURL = $(element).attr('href');
                if (tpaginationURL.includes('#')) {
                    const detail = $(element).attr('onclick');
                    if (detail) {
                        const detailKey = detail.match(/[0-9]+/)[0];
                        const context = $(element).text();
                        detailMap[detailKey] = context;
                        lastEvent = detailKey;
                    }
                } else if (tpaginationURL.includes('ManNo')) {
                    if (!prev_key[lastEvent] && lastEvent !== '') {
                        const artId = tpaginationURL.split('ManNo=')[1];
                        if (!artistMap[artId]) {
                            artistMap[artId] = {};
                            artistMap[artId]['event'] = [`http://www.playdb.co.kr/playdb/playdbDetail.asp?sReqPlayno=${lastEvent}`];
                        } else {
                            artistMap[artId]['event'].push(`http://www.playdb.co.kr/playdb/playdbDetail.asp?sReqPlayno=${lastEvent}`);
                        }
                    }
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
    console.log("EVENTS============")
    const eventMap = {};
    const eventDesc = {};
    urls.map((ele)=>{eventMap[ele.key] = true});
    await Promise.all(Object.keys(eventMap).map(async(key)=>{
        const paginationURL = `http://www.playdb.co.kr/playdb/playdbDetail.asp?sReqPlayno=${key}`;
        const pageHTML = await axios.get(paginationURL, { responseType: 'arraybuffer' });
        const content = iconv.decode(pageHTML.data, 'EUC-KR').toString()
        const $ = cheerio.load(content);
        // const titleElement = $('div.detaillist td');
        // class가 "detail"인 <div> 요소를 선택합니다.
        const detailElement = $('div.detaillist');

        // <div> 요소 내의 모든 <td> 요소를 선택합니다.
        const tdElements = detailElement.find('td');

        // <td> 요소의 텍스트 콘텐츠를 가져와 배열로 변환합니다.
        const texts = tdElements.map((index, element) => $(element).text()).get();

        // 배열의 각 요소를 출력합니다.
        let desc = ""
        texts.map(text => {
            desc = desc + text;
        });
        eventDesc[key] = desc.trim().replace(/(\t)|(\n)/g,'');
        // texts.forEach(text => console.log(text));
        // console.log(detailElement.text());
    }))
    console.log("ARTIST============")
    await Promise.all(Object.keys(artistMap).map(async(key)=>{
        const paginationURL = `http://www.playdb.co.kr/artistdb/detail.asp?ManNo=${key}`;
        const pageHTML = await axios.get(paginationURL, { responseType: 'arraybuffer' });
        const content = iconv.decode(pageHTML.data, 'EUC-KR').toString()
        const $ = cheerio.load(content);
        const titleElement = $('span.title');
        artistMap[key]['name'] = titleElement.text();
        artistMap[key]['url'] = paginationURL;
    }))
    const artistInfo = Object.keys(artistMap).map((key)=>{
        return {
            name: artistMap[key].name,
            url: artistMap[key].url,
            events: artistMap[key]['event'].map((ele)=>({
                url: ele,
                description: eventDesc[ele.split('sReqPlayno=')[1]]
            }))
        }
    })
    fs.writeFileSync(`artist_${new Date().getTime()}.json`, JSON.stringify(artistInfo))
    if (urls.length !== 0) {
        await new_artist_collection.insertMany(urls)
    }
}
main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });