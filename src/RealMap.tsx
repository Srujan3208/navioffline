import React,{useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Download,LocateFixed,Layers,Trash2,WifiOff} from 'lucide-react';

const DB='navio-map-tiles-v1',STORE='tiles';
function openDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function readTile(key:string){const db=await openDb();return new Promise<any>((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saveTile(key:string,data:ArrayBuffer){const db=await openDb();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
function tileXY(lon:number,lat:number,z:number){const n=2**z;return{x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n)}}
function tileUrl(z:number,x:number,y:number){return `https://tiles.openfreemap.org/planet/${z}/${x}/${y}.pbf`;}
export default function RealMap({downloadMode=false,onDownloaded,onRoute}:any){
 const el=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),[ready,setReady]=useState(false),[progress,setProgress]=useState(''),[offline,setOffline]=useState(!navigator.onLine);
 useEffect(()=>{const online=()=>setOffline(!navigator.onLine);window.addEventListener('online',online);window.addEventListener('offline',online);
 if(!el.current)return;
 map.current=new maplibregl.Map({container:el.current,style:'https://tiles.openfreemap.org/styles/liberty',center:[74.99,13.34],zoom:11,attributionControl:true});
 map.current.addControl(new maplibregl.NavigationControl({showCompass:true}), 'top-right');
 map.current.on('load',()=>setReady(true));
 map.current.on('click',e=>{if(downloadMode){new maplibregl.Marker({color:'#6d28d9'}).setLngLat(e.lngLat).addTo(map.current!);}});
 return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',online);map.current?.remove();map.current=null;};},[downloadMode]);
 const locate=()=>navigator.geolocation?.getCurrentPosition(p=>map.current?.flyTo({center:[p.coords.longitude,p.coords.latitude],zoom:15}),()=>setProgress('Location permission unavailable'));
 const downloadArea=async()=>{if(!map.current)return;const b=map.current.getBounds();const min=b.getSouthWest(),max=b.getNorthEast();const zmin=10,zmax=14;let total=0,done=0;for(let z=zmin;z<=zmax;z++){const a=tileXY(min.lng,max.lat,z),c=tileXY(max.lng,min.lat,z);total+=(c.x-a.x+1)*(c.y-a.y+1);}if(total>3500){setProgress('Area too large. Zoom in and select a smaller region.');return;}try{for(let z=zmin;z<=zmax;z++){const a=tileXY(min.lng,max.lat,z),c=tileXY(max.lng,min.lat,z);for(let x=a.x;x<=c.x;x++)for(let y=a.y;y<=c.y;y++){const url=tileUrl(z,x,y);const cached=await readTile(url);if(!cached){const r=await fetch(url);if(!r.ok)throw new Error('Tile download failed');await saveTile(url,await r.arrayBuffer());}done++;setProgress(`Downloading map tiles ${done}/${total}`);}}localStorage.setItem('navio-offline-area',JSON.stringify({bounds:[min.lng,min.lat,max.lng,max.lat],zooms:[zmin,zmax],tiles:total,downloadedAt:Date.now()}));setProgress(`Offline map saved: ${total} tiles`);onDownloaded?.();}catch(e:any){setProgress('Download interrupted: '+e.message);}};
 return <div className="real-map-wrap"><div ref={el} className="real-map"/><div className="real-map-actions"><button onClick={locate} aria-label="Locate me"><LocateFixed/></button><button onClick={()=>setProgress(offline?'Offline mode':'Online map')} aria-label="Network status"><WifiOff/></button>{downloadMode&&<button onClick={downloadArea}><Download/></button>}</div>{downloadMode&&<div className="real-map-download"><strong>Download visible area</strong><small>Tiles for zoom levels 10–14 are saved in this browser.</small><button onClick={downloadArea}><Download/> Download area</button>{progress&&<span>{progress}</span>}</div>}</div>;
}