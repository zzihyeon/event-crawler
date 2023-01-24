const axios = require("axios");
const cheerio = require("cheerio");
const http = require('http');
const fs = require('fs');
var iconv  = require('iconv-lite');

async function main(maxPages = 50) {
    // initialized with the first webpage to visit
    const paginationURLsToVisit = [];
    for (let i=1;i<10;i++) {
        for (let j=1;j<3;j++) {
            paginationURLsToVisit.push(`http://www.playdb.co.kr/playdb/playdblist.asp?Page=${j}&sReqMainCategory=00000${i}&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1`)
        }
    }
    const visitedURLs = [];
    // iterating until the queue is empty
    // or the iteration limit is hit
    const urls = [];
    while (
        paginationURLsToVisit.length !== 0 &&
        visitedURLs.length <= maxPages
        ) {
        // the current webpage to crawl
        const paginationURL = paginationURLsToVisit.pop();

        // retrieving the HTML content from paginationURL 
        const pageHTML = await axios.get(paginationURL,{
            Headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}
        });
        
        // const strContents_prev = iconv.decode(pageHTML.data,'euckr')
        // const strContents = iconv.encode(strContents_prev,'utf8')
        // fs.writeFileSync('zz.txt',strContents)
        const detailMap = {};
        // adding the current webpage to the
        // web pages already crawled
        visitedURLs.push(paginationURL);


        // initializing cheerio on the current webpage
        const $ = cheerio.load(pageHTML.data);

        // console.log(pageHTML.data);
        $('a').each((index, element) => {
            const tpaginationURL = $(element).attr("href");
            if (tpaginationURL.includes("#")) {
                const detail = $(element).attr("onclick");
                const detailKey = detail.slice(10,16);
                const context = $(element).text();
                detailMap[detailKey] = context;
            }
        })
        
        const newURLs = Object.keys(detailMap).map((key)=>{
            return {name: detailMap[key],key: key, url: `http://www.playdb.co.kr/playdb/playdbDetail.asp?sReqPlayno=${key}`}
        })
        urls.push(...newURLs)
    }
    fs.writeFileSync('new.json',JSON.stringify(urls))
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        // logging the error message
        console.error(e);

        process.exit(1);
    });
