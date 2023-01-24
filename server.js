const axios = require("axios");
const cheerio = require("cheerio");
const http = require('http');
const fs = require('fs');
var iconv  = require('iconv-lite');

async function main(maxPages = 50) {
    // initialized with the first webpage to visit
    const paginationURLsToVisit = [
        "http://www.playdb.co.kr/playdb/playdblist.asp?Page=1&sReqMainCategory=000001&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1",
        "http://www.playdb.co.kr/playdb/playdblist.asp?Page=2&sReqMainCategory=000001&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1",
        "http://www.playdb.co.kr/playdb/playdblist.asp?Page=3&sReqMainCategory=000001&sReqSubCategory=&sReqDistrict=&sReqTab=2&sPlayType=3&sStartYear=&sSelectType=1"];
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
        
        fs.writeFileSync('zz.txt',pageHTML.data)
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
    console.log(urls)
    fs.writeFileSync('test.json',JSON.stringify(urls))
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
