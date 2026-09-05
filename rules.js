/* Shared, deterministic rules. No DOM or storage access. */
(function(root) {
    const fresh = () => ({saveVersion:2,directionSense:0,frogSpeedLevel:0,frogValueLevel:0,valueUpgradeCount:0,speedUpgradeCount:0,unlockedFloors:[1],unlockedBooks:[],babelFloor:1,babelOrbBonus:0,towerCompleted:false,babelPlayerCards:[],babelEnemyCards:[],babelChallengeType:null,babelEnemyHp:null,battleSnapshot:null,collectedFragments:[],achievedEndings:[],completedStories:[],collectionFragments:[],collectionStories:[],resetCount:0,lastSaveTime:0});
    function normalize(raw) {
        const d=fresh(); if(!raw || typeof raw!=='object' || Array.isArray(raw))return d;
        Object.keys(d).forEach(k=>{if(raw[k]!==undefined)d[k]=raw[k]});
        const numeric=['directionSense','frogSpeedLevel','frogValueLevel','valueUpgradeCount','speedUpgradeCount','babelFloor','babelOrbBonus','resetCount','lastSaveTime'];
        numeric.forEach(k=>{if(typeof d[k]!=='number'||!Number.isFinite(d[k]))d[k]=fresh()[k]});
        d.directionSense=Math.max(-10000,Math.min(1e12,d.directionSense));
        d.frogSpeedLevel=Math.min(10,Math.max(0,Math.floor(d.frogSpeedLevel)));
        d.frogValueLevel=Math.min(100,Math.max(0,d.frogValueLevel));
        d.speedUpgradeCount=Math.max(0,Math.min(1000,Math.floor(d.speedUpgradeCount)));
        d.valueUpgradeCount=Math.max(0,Math.min(100,Math.floor(d.valueUpgradeCount)));
        if(raw.speedUpgradeCount===undefined)d.speedUpgradeCount=d.frogSpeedLevel;
        if(raw.valueUpgradeCount===undefined)d.valueUpgradeCount=Math.floor(d.frogValueLevel);
        d.babelFloor=Math.min(99,Math.max(1,Math.floor(d.babelFloor)));
        d.babelOrbBonus=Math.max(0,Math.min(495,d.babelOrbBonus));
        for(const k of ['collectedFragments','completedStories','collectionFragments','collectionStories','achievedEndings','babelPlayerCards','babelEnemyCards']) d[k]=[...new Set((Array.isArray(d[k])?d[k]:[]).filter(v=>typeof v==='string'))];
        for(const [k,lo,hi] of [['unlockedFloors',1,9],['unlockedBooks',0,179]])d[k]=[...new Set((Array.isArray(d[k])?d[k]:[]).filter(v=>Number.isInteger(v)&&v>=lo&&v<=hi))];
        if(!d.unlockedFloors.includes(1))d.unlockedFloors.unshift(1);
        d.babelChallengeType=['card','dice'].includes(d.babelChallengeType)?d.babelChallengeType:null;
        d.babelEnemyHp=Number.isFinite(d.babelEnemyHp)&&d.babelEnemyHp>=8&&d.babelEnemyHp<=40?d.babelEnemyHp:null;
        d.towerCompleted=d.towerCompleted===true; d.saveVersion=2;
        return d;
    }
    const interval=d=>Math.max(2500,7500-d.frogSpeedLevel*500);
    const orbValue=d=>(1+d.frogValueLevel)*(1+d.collectedFragments.length*.01+d.completedStories.length*.1+d.babelOrbBonus*.01)*(d.directionSense<0?.5:1);
    const speedCost=d=>Math.floor(15*Math.pow(1.25,d.frogSpeedLevel));
    const valueCost=d=>Math.floor(100*Math.pow(2,d.valueUpgradeCount));
    // Split a debt-crossing award so online and offline collection have identical value.
    function award(d,count){const before=d.directionSense;if(d.directionSense<0){const n=Math.min(count,Math.ceil(-d.directionSense/orbValue(d)));d.directionSense+=n*orbValue(d);count-=n;}d.directionSense=Math.min(1e12,d.directionSense+count*orbValue(d));return d.directionSense-before;}
    function offline(d,now){const elapsed=Math.max(0,Math.min(8*60*60*1000,now-d.lastSaveTime));return d.lastSaveTime&&elapsed>=60000?award(d,Math.floor(elapsed/interval(d))):0;}
    function upgrade(d,type){if(!['speed','value'].includes(type))return false;if(type==='speed'&&d.frogSpeedLevel>=10||type==='value'&&d.frogSpeedLevel<10)return false;const cost=type==='speed'?speedCost(d):valueCost(d);if(d.directionSense<cost)return false;d.directionSense-=cost;if(type==='speed'){d.frogSpeedLevel++;d.speedUpgradeCount++;}else{d.frogValueLevel++;d.valueUpgradeCount++;}return true;}
    function diceResult(p,e,pRoll,eRoll){if(pRoll>eRoll)p++;else if(eRoll>pRoll)e++;return {playerWins:p,enemyWins:e,winner:p>=2?'player':e>=2?'enemy':null};}
    const api={fresh,normalize,interval,orbValue,speedCost,valueCost,award,offline,upgrade,diceResult};
    if(typeof module!=='undefined')module.exports=api;else root.BabelRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
