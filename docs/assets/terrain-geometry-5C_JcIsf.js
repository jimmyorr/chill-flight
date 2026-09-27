(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.prototype.toString;function t(t){switch(e.call(t)){case`[object Error]`:case`[object Exception]`:case`[object DOMException]`:return!0;default:return h(t,Error)}}function n(t,n){return e.call(t)===`[object ${n}]`}function r(e){return n(e,`ErrorEvent`)}function i(e){return n(e,`DOMError`)}function a(e){return n(e,`DOMException`)}function o(e){return n(e,`String`)}function s(e){return typeof e==`object`&&!!e&&`__sentry_template_string__`in e&&`__sentry_template_values__`in e}function c(e){return e===null||s(e)||typeof e!=`object`&&typeof e!=`function`}function l(e){return n(e,`Object`)}function u(e){return typeof Event<`u`&&h(e,Event)}function d(e){return typeof Element<`u`&&h(e,Element)}function f(e){return n(e,`RegExp`)}function p(e){return!!(e&&e.then&&typeof e.then==`function`)}function m(e){return l(e)&&`nativeEvent`in e&&`preventDefault`in e&&`stopPropagation`in e}function h(e,t){try{return e instanceof t}catch{return!1}}function g(e){return!!(typeof e==`object`&&e&&(e.__isVue||e._isVue))}function _(e,t=0){return typeof e!=`string`||t===0||e.length<=t?e:`${e.slice(0,t)}...`}function v(e,t){if(!Array.isArray(e))return``;let n=[];for(let t=0;t<e.length;t++){let r=e[t];try{g(r)?n.push(`[VueViewModel]`):n.push(String(r))}catch{n.push(`[value cannot be serialized]`)}}return n.join(t)}function y(e,t,n=!1){return o(e)?f(t)?t.test(e):o(t)?n?e===t:e.includes(t):!1:!1}function b(e,t=[],n=!1){return t.some(t=>y(e,t,n))}function x(e,t,n=250,r,i,a,o){if(!a.exception||!a.exception.values||!o||!h(o.originalException,Error))return;let s=a.exception.values.length>0?a.exception.values[a.exception.values.length-1]:void 0;s&&(a.exception.values=T(S(e,t,i,o.originalException,r,a.exception.values,s,0),n))}function S(e,t,n,r,i,a,o,s){if(a.length>=n+1)return a;let c=[...a];if(h(r[i],Error)){C(o,s);let a=e(t,r[i]),l=c.length;w(a,i,l,s),c=S(e,t,n,r[i],i,[a,...c],a,l)}return Array.isArray(r.errors)&&r.errors.forEach((r,a)=>{if(h(r,Error)){C(o,s);let l=e(t,r),u=c.length;w(l,`errors[${a}]`,u,s),c=S(e,t,n,r,i,[l,...c],l,u)}}),c}function C(e,t){e.mechanism=e.mechanism||{type:`generic`,handled:!0},e.mechanism={...e.mechanism,...e.type===`AggregateError`&&{is_exception_group:!0},exception_id:t}}function w(e,t,n,r){e.mechanism=e.mechanism||{type:`generic`,handled:!0},e.mechanism={...e.mechanism,type:`chained`,source:t,exception_id:n,parent_id:r}}function T(e,t){return e.map(e=>(e.value&&=_(e.value,t),e))}var E=`8.26.0`,D=globalThis;function O(e,t,n){let r=n||D,i=r.__SENTRY__=r.__SENTRY__||{},a=i[E]=i[`8.26.0`]||{};return a[e]||(a[e]=t())}var k=D,A=80;function j(e,t={}){if(!e)return`<unknown>`;try{let n=e,r=[],i=0,a=0,o,s=Array.isArray(t)?t:t.keyAttrs,c=!Array.isArray(t)&&t.maxStringLength||A;for(;n&&i++<5&&(o=ee(n,s),!(o===`html`||i>1&&a+r.length*3+o.length>=c));)r.push(o),a+=o.length,n=n.parentNode;return r.reverse().join(` > `)}catch{return`<unknown>`}}function ee(e,t){let n=e,r=[];if(!n||!n.tagName)return``;if(k.HTMLElement&&n instanceof HTMLElement&&n.dataset){if(n.dataset.sentryComponent)return n.dataset.sentryComponent;if(n.dataset.sentryElement)return n.dataset.sentryElement}r.push(n.tagName.toLowerCase());let i=t&&t.length?t.filter(e=>n.getAttribute(e)).map(e=>[e,n.getAttribute(e)]):null;if(i&&i.length)i.forEach(e=>{r.push(`[${e[0]}="${e[1]}"]`)});else{n.id&&r.push(`#${n.id}`);let e=n.className;if(e&&o(e)){let t=e.split(/\s+/);for(let e of t)r.push(`.${e}`)}}for(let e of[`aria-label`,`type`,`name`,`title`,`alt`]){let t=n.getAttribute(e);t&&r.push(`[${e}="${t}"]`)}return r.join(``)}function M(){try{return k.document.location.href}catch{return``}}function te(e){if(!k.HTMLElement)return null;let t=e;for(let e=0;e<5;e++){if(!t)return null;if(t instanceof HTMLElement){if(t.dataset.sentryComponent)return t.dataset.sentryComponent;if(t.dataset.sentryElement)return t.dataset.sentryElement}t=t.parentNode}return null}var N=typeof __SENTRY_DEBUG__>`u`||__SENTRY_DEBUG__,P=`Sentry Logger `,ne=[`debug`,`info`,`warn`,`error`,`log`,`assert`,`trace`],re={};function ie(e){if(!(`console`in D))return e();let t=D.console,n={},r=Object.keys(re);r.forEach(e=>{let r=re[e];n[e]=t[e],t[e]=r});try{return e()}finally{r.forEach(e=>{t[e]=n[e]})}}function ae(){let e=!1,t={enable:()=>{e=!0},disable:()=>{e=!1},isEnabled:()=>e};return N?ne.forEach(n=>{t[n]=(...t)=>{e&&ie(()=>{D.console[n](`${P}[${n}]:`,...t)})}}):ne.forEach(e=>{t[e]=()=>void 0}),t}var F=ae(),oe=/^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;function se(e){return e===`http`||e===`https`}function I(e,t=!1){let{host:n,path:r,pass:i,port:a,projectId:o,protocol:s,publicKey:c}=e;return`${s}://${c}${t&&i?`:${i}`:``}@${n}${a?`:${a}`:``}/${r&&`${r}/`}${o}`}function L(e){let t=oe.exec(e);if(!t){ie(()=>{console.error(`Invalid Sentry Dsn: ${e}`)});return}let[n,r,i=``,a=``,o=``,s=``]=t.slice(1),c=``,l=s,u=l.split(`/`);if(u.length>1&&(c=u.slice(0,-1).join(`/`),l=u.pop()),l){let e=l.match(/^\d+/);e&&(l=e[0])}return ce({host:a,pass:i,path:c,projectId:l,port:o,protocol:n,publicKey:r})}function ce(e){return{protocol:e.protocol,publicKey:e.publicKey||``,pass:e.pass||``,host:e.host,port:e.port||``,path:e.path||``,projectId:e.projectId}}function le(e){if(!N)return!0;let{port:t,projectId:n,protocol:r}=e;return[`protocol`,`publicKey`,`host`,`projectId`].find(t=>e[t]?!1:(F.error(`Invalid Sentry Dsn: ${t} missing`),!0))?!1:n.match(/^\d+$/)?se(r)?t&&isNaN(parseInt(t,10))?(F.error(`Invalid Sentry Dsn: Invalid port ${t}`),!1):!0:(F.error(`Invalid Sentry Dsn: Invalid protocol ${r}`),!1):(F.error(`Invalid Sentry Dsn: Invalid projectId ${n}`),!1)}function ue(e){let t=typeof e==`string`?L(e):ce(e);if(!(!t||!le(t)))return t}var de=class extends Error{constructor(e,t=`warn`){super(e),this.message=e,this.name=new.target.prototype.constructor.name,Object.setPrototypeOf(this,new.target.prototype),this.logLevel=t}};function fe(e,t,n){if(!(t in e))return;let r=e[t],i=n(r);typeof i==`function`&&me(i,r),e[t]=i}function pe(e,t,n){try{Object.defineProperty(e,t,{value:n,writable:!0,configurable:!0})}catch{N&&F.log(`Failed to add non-enumerable property "${t}" to object`,e)}}function me(e,t){try{e.prototype=t.prototype=t.prototype||{},pe(e,`__sentry_original__`,t)}catch{}}function he(e){return e.__sentry_original__}function ge(e){return Object.keys(e).map(t=>`${encodeURIComponent(t)}=${encodeURIComponent(e[t])}`).join(`&`)}function _e(e){if(t(e))return{message:e.message,name:e.name,stack:e.stack,...ye(e)};if(u(e)){let t={type:e.type,target:ve(e.target),currentTarget:ve(e.currentTarget),...ye(e)};return typeof CustomEvent<`u`&&h(e,CustomEvent)&&(t.detail=e.detail),t}else return e}function ve(e){try{return d(e)?j(e):Object.prototype.toString.call(e)}catch{return`<unknown>`}}function ye(e){if(typeof e==`object`&&e){let t={};for(let n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[n]=e[n]);return t}else return{}}function R(e,t=40){let n=Object.keys(_e(e));n.sort();let r=n[0];if(!r)return`[object has no keys]`;if(r.length>=t)return _(r,t);for(let e=n.length;e>0;e--){let r=n.slice(0,e).join(`, `);if(!(r.length>t))return e===n.length?r:_(r,t)}return``}function be(e){return xe(e,new Map)}function xe(e,t){if(Se(e)){let n=t.get(e);if(n!==void 0)return n;let r={};t.set(e,r);for(let n of Object.keys(e))e[n]!==void 0&&(r[n]=xe(e[n],t));return r}if(Array.isArray(e)){let n=t.get(e);if(n!==void 0)return n;let r=[];return t.set(e,r),e.forEach(e=>{r.push(xe(e,t))}),r}return e}function Se(e){if(!l(e))return!1;try{let t=Object.getPrototypeOf(e).constructor.name;return!t||t===`Object`}catch{return!0}}var z=50,Ce=/\(error: (.*)\)/,B=/captureMessage|captureException/;function V(...e){let t=e.sort((e,t)=>e[0]-t[0]).map(e=>e[1]);return(e,n=0,r=0)=>{let i=[],a=e.split(`
`);for(let e=n;e<a.length;e++){let n=a[e];if(n.length>1024)continue;let o=Ce.test(n)?n.replace(Ce,`$1`):n;if(!o.match(/\S*Error: /)){for(let e of t){let t=e(o);if(t){i.push(t);break}}if(i.length>=z+r)break}}return Te(i.slice(r))}}function we(e){return Array.isArray(e)?V(...e):e}function Te(e){if(!e.length)return[];let t=Array.from(e);return/sentryWrapped/.test(Ee(t).function||``)&&t.pop(),t.reverse(),B.test(Ee(t).function||``)&&(t.pop(),B.test(Ee(t).function||``)&&t.pop()),t.slice(0,z).map(e=>({...e,filename:e.filename||Ee(t).filename,function:e.function||`?`}))}function Ee(e){return e[e.length-1]||{}}var De=`<anonymous>`;function Oe(e){try{return!e||typeof e!=`function`?De:e.name||De}catch{return De}}function ke(e){let t=e.exception;if(t){let e=[];try{return t.values.forEach(t=>{t.stacktrace.frames&&e.push(...t.stacktrace.frames)}),e}catch{return}}}var Ae={},je={};function Me(e,t){Ae[e]=Ae[e]||[],Ae[e].push(t)}function Ne(e,t){je[e]||(t(),je[e]=!0)}function Pe(e,t){let n=e&&Ae[e];if(n)for(let r of n)try{r(t)}catch(t){N&&F.error(`Error while triggering instrumentation handler.\nType: ${e}\nName: ${Oe(r)}\nError:`,t)}}function Fe(e){let t=`console`;Me(t,e),Ne(t,Ie)}function Ie(){`console`in D&&ne.forEach(function(e){e in D.console&&fe(D.console,e,function(t){return re[e]=t,function(...t){Pe(`console`,{args:t,level:e});let n=re[e];n&&n.apply(D.console,t)}})})}var Le=D;function Re(){if(!(`fetch`in Le))return!1;try{return new Headers,new Request(`http://www.example.com`),new Response,!0}catch{return!1}}function ze(e){return e&&/^function\s+\w+\(\)\s+\{\s+\[native code\]\s+\}$/.test(e.toString())}function Be(){if(typeof EdgeRuntime==`string`)return!0;if(!Re())return!1;if(ze(Le.fetch))return!0;let e=!1,t=Le.document;if(t&&typeof t.createElement==`function`)try{let n=t.createElement(`iframe`);n.hidden=!0,t.head.appendChild(n),n.contentWindow&&n.contentWindow.fetch&&(e=ze(n.contentWindow.fetch)),t.head.removeChild(n)}catch(e){N&&F.warn(`Could not create sandbox iframe for pure fetch check, bailing to window.fetch: `,e)}return e}var Ve=1e3;function He(){return Date.now()/Ve}function Ue(){let{performance:e}=D;if(!e||!e.now)return He;let t=Date.now()-e.now(),n=e.timeOrigin==null?t:e.timeOrigin;return()=>(n+e.now())/Ve}var We=Ue();(()=>{let{performance:e}=D;if(!e||!e.now)return;let t=3600*1e3,n=e.now(),r=Date.now(),i=e.timeOrigin?Math.abs(e.timeOrigin+n-r):t,a=i<t,o=e.timing&&e.timing.navigationStart,s=typeof o==`number`?Math.abs(o+n-r):t;return a||s<t?i<=s?e.timeOrigin:o:r})();function Ge(e,t){let n=`fetch`;Me(n,e),Ne(n,()=>H(void 0,t))}function H(e,n=!1){n&&!Be()||fe(D,`fetch`,function(n){return function(...r){let{method:i,url:a}=Je(r),o={args:r,fetchData:{method:i,url:a},startTimestamp:We()*1e3};e||Pe(`fetch`,{...o});let s=Error().stack;return n.apply(D,r).then(async t=>(e?e(t):Pe(`fetch`,{...o,endTimestamp:We()*1e3,response:t}),t),e=>{throw Pe(`fetch`,{...o,endTimestamp:We()*1e3,error:e}),t(e)&&e.stack===void 0&&(e.stack=s,pe(e,`framesToPop`,1)),e})}})}function Ke(e,t){return!!e&&typeof e==`object`&&!!e[t]}function qe(e){return typeof e==`string`?e:e?Ke(e,`url`)?e.url:e.toString?e.toString():``:``}function Je(e){if(e.length===0)return{method:`GET`,url:``};if(e.length===2){let[t,n]=e;return{url:qe(t),method:Ke(n,`method`)?String(n.method).toUpperCase():`GET`}}let t=e[0];return{url:qe(t),method:Ke(t,`method`)?String(t.method).toUpperCase():`GET`}}var Ye=null;function Xe(e){let t=`error`;Me(t,e),Ne(t,Ze)}function Ze(){Ye=D.onerror,D.onerror=function(e,t,n,r,i){return Pe(`error`,{column:r,error:i,line:n,msg:e,url:t}),Ye&&!Ye.__SENTRY_LOADER__?Ye.apply(this,arguments):!1},D.onerror.__SENTRY_INSTRUMENTED__=!0}var Qe=null;function $e(e){let t=`unhandledrejection`;Me(t,e),Ne(t,et)}function et(){Qe=D.onunhandledrejection,D.onunhandledrejection=function(e){return Pe(`unhandledrejection`,e),Qe&&!Qe.__SENTRY_LOADER__?Qe.apply(this,arguments):!0},D.onunhandledrejection.__SENTRY_INSTRUMENTED__=!0}function tt(){return`npm`}function nt(){let e=typeof WeakSet==`function`,t=e?new WeakSet:[];function n(n){if(e)return t.has(n)?!0:(t.add(n),!1);for(let e=0;e<t.length;e++)if(t[e]===n)return!0;return t.push(n),!1}function r(n){if(e)t.delete(n);else for(let e=0;e<t.length;e++)if(t[e]===n){t.splice(e,1);break}}return[n,r]}function rt(){let e=D,t=e.crypto||e.msCrypto,n=()=>Math.random()*16;try{if(t&&t.randomUUID)return t.randomUUID().replace(/-/g,``);t&&t.getRandomValues&&(n=()=>{let e=new Uint8Array(1);return t.getRandomValues(e),e[0]})}catch{}return`10000000100040008000100000000000`.replace(/[018]/g,e=>(e^(n()&15)>>e/4).toString(16))}function it(e){return e.exception&&e.exception.values?e.exception.values[0]:void 0}function at(e){let{message:t,event_id:n}=e;if(t)return t;let r=it(e);return r?r.type&&r.value?`${r.type}: ${r.value}`:r.type||r.value||n||`<unknown>`:n||`<unknown>`}function ot(e,t,n){let r=e.exception=e.exception||{},i=r.values=r.values||[],a=i[0]=i[0]||{};a.value||=t||``,a.type||=n||`Error`}function st(e,t){let n=it(e);if(!n)return;let r={type:`generic`,handled:!0},i=n.mechanism;if(n.mechanism={...r,...i,...t},t&&`data`in t){let e={...i&&i.data,...t.data};n.mechanism.data=e}}function ct(e){if(e&&e.__sentry_captured__)return!0;try{pe(e,`__sentry_captured__`,!0)}catch{}return!1}function lt(e){return Array.isArray(e)?e:[e]}function ut(e,t=100,n=1/0){try{return ft(``,e,t,n)}catch(e){return{ERROR:`**non-serializable** (${e})`}}}function dt(e,t=3,n=100*1024){let r=ut(e,t);return gt(r)>n?dt(e,t-1,n):r}function ft(e,t,n=1/0,r=1/0,i=nt()){let[a,o]=i;if(t==null||[`number`,`boolean`,`string`].includes(typeof t)&&!Number.isNaN(t))return t;let s=pt(e,t);if(!s.startsWith(`[object `))return s;if(t.__sentry_skip_normalization__)return t;let c=typeof t.__sentry_override_normalization_depth__==`number`?t.__sentry_override_normalization_depth__:n;if(c===0)return s.replace(`object `,``);if(a(t))return`[Circular ~]`;let l=t;if(l&&typeof l.toJSON==`function`)try{return ft(``,l.toJSON(),c-1,r,i)}catch{}let u=Array.isArray(t)?[]:{},d=0,f=_e(t);for(let e in f){if(!Object.prototype.hasOwnProperty.call(f,e))continue;if(d>=r){u[e]=`[MaxProperties ~]`;break}let t=f[e];u[e]=ft(e,t,c-1,r,i),d++}return o(t),u}function pt(e,t){try{if(e===`domain`&&t&&typeof t==`object`&&t._events)return`[Domain]`;if(e===`domainEmitter`)return`[DomainEmitter]`;if(typeof global<`u`&&t===global)return`[Global]`;if(typeof window<`u`&&t===window)return`[Window]`;if(typeof document<`u`&&t===document)return`[Document]`;if(g(t))return`[VueViewModel]`;if(m(t))return`[SyntheticEvent]`;if(typeof t==`number`&&t!==t)return`[NaN]`;if(typeof t==`function`)return`[Function: ${Oe(t)}]`;if(typeof t==`symbol`)return`[${String(t)}]`;if(typeof t==`bigint`)return`[BigInt: ${String(t)}]`;let n=mt(t);return/^HTML(\w*)Element$/.test(n)?`[HTMLElement: ${n}]`:`[object ${n}]`}catch(e){return`**non-serializable** (${e})`}}function mt(e){let t=Object.getPrototypeOf(e);return t?t.constructor.name:`null prototype`}function ht(e){return~-encodeURI(e).split(/%..|./).length}function gt(e){return ht(JSON.stringify(e))}var _t;(function(e){e[e.PENDING=0]=`PENDING`,e[e.RESOLVED=1]=`RESOLVED`,e[e.REJECTED=2]=`REJECTED`})(_t||={});function vt(e){return new bt(t=>{t(e)})}function yt(e){return new bt((t,n)=>{n(e)})}var bt=class e{constructor(t){e.prototype.__init.call(this),e.prototype.__init2.call(this),e.prototype.__init3.call(this),e.prototype.__init4.call(this),this._state=_t.PENDING,this._handlers=[];try{t(this._resolve,this._reject)}catch(e){this._reject(e)}}then(t,n){return new e((e,r)=>{this._handlers.push([!1,n=>{if(!t)e(n);else try{e(t(n))}catch(e){r(e)}},t=>{if(!n)r(t);else try{e(n(t))}catch(e){r(e)}}]),this._executeHandlers()})}catch(e){return this.then(e=>e,e)}finally(t){return new e((e,n)=>{let r,i;return this.then(e=>{i=!1,r=e,t&&t()},e=>{i=!0,r=e,t&&t()}).then(()=>{if(i){n(r);return}e(r)})})}__init(){this._resolve=e=>{this._setResult(_t.RESOLVED,e)}}__init2(){this._reject=e=>{this._setResult(_t.REJECTED,e)}}__init3(){this._setResult=(e,t)=>{if(this._state===_t.PENDING){if(p(t)){t.then(this._resolve,this._reject);return}this._state=e,this._value=t,this._executeHandlers()}}}__init4(){this._executeHandlers=()=>{if(this._state===_t.PENDING)return;let e=this._handlers.slice();this._handlers=[],e.forEach(e=>{e[0]||=(this._state===_t.RESOLVED&&e[1](this._value),this._state===_t.REJECTED&&e[2](this._value),!0)})}}};function xt(e){let t=[];function n(){return e===void 0||t.length<e}function r(e){return t.splice(t.indexOf(e),1)[0]||Promise.resolve(void 0)}function i(e){if(!n())return yt(new de(`Not adding Promise because buffer limit was reached.`));let i=e();return t.indexOf(i)===-1&&t.push(i),i.then(()=>r(i)).then(null,()=>r(i).then(null,()=>{})),i}function a(e){return new bt((n,r)=>{let i=t.length;if(!i)return n(!0);let a=setTimeout(()=>{e&&e>0&&n(!1)},e);t.forEach(e=>{vt(e).then(()=>{--i||(clearTimeout(a),n(!0))},r)})})}return{$:t,add:i,drain:a}}function St(e){if(!e)return{};let t=e.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);if(!t)return{};let n=t[6]||``,r=t[8]||``;return{host:t[4],path:t[5],protocol:t[2],search:n,hash:r,relative:t[5]+n+r}}var Ct=[`fatal`,`error`,`warning`,`log`,`info`,`debug`];function wt(e){return e===`warn`?`warning`:Ct.includes(e)?e:`log`}var Tt=/^sentry-/;function Et(e){let t=Dt(e);if(!t)return;let n=Object.entries(t).reduce((e,[t,n])=>{if(t.match(Tt)){let r=t.slice(7);e[r]=n}return e},{});if(Object.keys(n).length>0)return n}function Dt(e){if(!(!e||!o(e)&&!Array.isArray(e)))return Array.isArray(e)?e.reduce((e,t)=>{let n=Ot(t);return Object.entries(n).forEach(([t,n])=>{e[t]=n}),e},{}):Ot(e)}function Ot(e){return e.split(`,`).map(e=>e.split(`=`).map(e=>decodeURIComponent(e.trim()))).reduce((e,[t,n])=>(t&&n&&(e[t]=n),e),{})}function kt(e,t=[]){return[e,t]}function At(e,t){let[n,r]=e;return[n,[...r,t]]}function jt(e,t){let n=e[1];for(let e of n){let n=e[0].type;if(t(e,n))return!0}return!1}function Mt(e){return D.__SENTRY__&&D.__SENTRY__.encodePolyfill?D.__SENTRY__.encodePolyfill(e):new TextEncoder().encode(e)}function Nt(e){let[t,n]=e,r=JSON.stringify(t);function i(e){typeof r==`string`?r=typeof e==`string`?r+e:[Mt(r),e]:r.push(typeof e==`string`?Mt(e):e)}for(let e of n){let[t,n]=e;if(i(`\n${JSON.stringify(t)}\n`),typeof n==`string`||n instanceof Uint8Array)i(n);else{let e;try{e=JSON.stringify(n)}catch{e=JSON.stringify(ut(n))}i(e)}}return typeof r==`string`?r:Pt(r)}function Pt(e){let t=e.reduce((e,t)=>e+t.length,0),n=new Uint8Array(t),r=0;for(let t of e)n.set(t,r),r+=t.length;return n}function Ft(e){let t=typeof e.data==`string`?Mt(e.data):e.data;return[be({type:`attachment`,length:t.length,filename:e.filename,content_type:e.contentType,attachment_type:e.attachmentType}),t]}var It={session:`session`,sessions:`session`,attachment:`attachment`,transaction:`transaction`,event:`error`,client_report:`internal`,user_report:`default`,profile:`profile`,profile_chunk:`profile`,replay_event:`replay`,replay_recording:`replay`,check_in:`monitor`,feedback:`feedback`,span:`span`,statsd:`metric_bucket`};function Lt(e){return It[e]}function Rt(e){if(!e||!e.sdk)return;let{name:t,version:n}=e.sdk;return{name:t,version:n}}function zt(e,t,n,r){let i=e.sdkProcessingMetadata&&e.sdkProcessingMetadata.dynamicSamplingContext;return{event_id:e.event_id,sent_at:new Date().toISOString(),...t&&{sdk:t},...!!n&&r&&{dsn:I(r)},...i&&{trace:be({...i})}}}function Bt(e,t,n){let r=[{type:`client_report`},{timestamp:n||He(),discarded_events:e}];return kt(t?{dsn:t}:{},[r])}var Vt=60*1e3;function Ht(e,t=Date.now()){let n=parseInt(`${e}`,10);if(!isNaN(n))return n*1e3;let r=Date.parse(`${e}`);return isNaN(r)?Vt:r-t}function Ut(e,t){return e[t]||e.all||0}function Wt(e,t,n=Date.now()){return Ut(e,t)>n}function Gt(e,{statusCode:t,headers:n},r=Date.now()){let i={...e},a=n&&n[`x-sentry-rate-limits`],o=n&&n[`retry-after`];if(a)for(let e of a.trim().split(`,`)){let[t,n,,,a]=e.split(`:`,5),o=parseInt(t,10),s=(isNaN(o)?60:o)*1e3;if(!n)i.all=r+s;else for(let e of n.split(`;`))e===`metric_bucket`?(!a||a.split(`;`).includes(`custom`))&&(i[e]=r+s):i[e]=r+s}else o?i.all=r+Ht(o,r):t===429&&(i.all=r+60*1e3);return i}function Kt(){return{traceId:rt(),spanId:rt().substring(16)}}var qt=D;function Jt(){let e=qt.chrome,t=e&&e.app&&e.app.runtime,n=`history`in qt&&!!qt.history.pushState&&!!qt.history.replaceState;return!t&&n}var Yt=typeof __SENTRY_DEBUG__>`u`||__SENTRY_DEBUG__;function Xt(){return Zt(D),D}function Zt(e){let t=e.__SENTRY__=e.__SENTRY__||{};return t.version=t.version||`8.26.0`,t[E]=t[`8.26.0`]||{}}function Qt(e){let t=We(),n={sid:rt(),init:!0,timestamp:t,started:t,duration:0,status:`ok`,errors:0,ignoreDuration:!1,toJSON:()=>tn(n)};return e&&$t(n,e),n}function $t(e,t={}){if(t.user&&(!e.ipAddress&&t.user.ip_address&&(e.ipAddress=t.user.ip_address),!e.did&&!t.did&&(e.did=t.user.id||t.user.email||t.user.username)),e.timestamp=t.timestamp||We(),t.abnormal_mechanism&&(e.abnormal_mechanism=t.abnormal_mechanism),t.ignoreDuration&&(e.ignoreDuration=t.ignoreDuration),t.sid&&(e.sid=t.sid.length===32?t.sid:rt()),t.init!==void 0&&(e.init=t.init),!e.did&&t.did&&(e.did=`${t.did}`),typeof t.started==`number`&&(e.started=t.started),e.ignoreDuration)e.duration=void 0;else if(typeof t.duration==`number`)e.duration=t.duration;else{let t=e.timestamp-e.started;e.duration=t>=0?t:0}t.release&&(e.release=t.release),t.environment&&(e.environment=t.environment),!e.ipAddress&&t.ipAddress&&(e.ipAddress=t.ipAddress),!e.userAgent&&t.userAgent&&(e.userAgent=t.userAgent),typeof t.errors==`number`&&(e.errors=t.errors),t.status&&(e.status=t.status)}function en(e,t){let n={};t?n={status:t}:e.status===`ok`&&(n={status:`exited`}),$t(e,n)}function tn(e){return be({sid:`${e.sid}`,init:e.init,started:new Date(e.started*1e3).toISOString(),timestamp:new Date(e.timestamp*1e3).toISOString(),status:e.status,errors:e.errors,did:typeof e.did==`number`||typeof e.did==`string`?`${e.did}`:void 0,duration:e.duration,abnormal_mechanism:e.abnormal_mechanism,attrs:{release:e.release,environment:e.environment,ip_address:e.ipAddress,user_agent:e.userAgent}})}var nn=`_sentrySpan`;function rn(e,t){t?pe(e,nn,t):delete e[nn]}function an(e){return e[nn]}var on=100,sn=class e{constructor(){this._notifyingListeners=!1,this._scopeListeners=[],this._eventProcessors=[],this._breadcrumbs=[],this._attachments=[],this._user={},this._tags={},this._extra={},this._contexts={},this._sdkProcessingMetadata={},this._propagationContext=Kt()}clone(){let t=new e;return t._breadcrumbs=[...this._breadcrumbs],t._tags={...this._tags},t._extra={...this._extra},t._contexts={...this._contexts},t._user=this._user,t._level=this._level,t._session=this._session,t._transactionName=this._transactionName,t._fingerprint=this._fingerprint,t._eventProcessors=[...this._eventProcessors],t._requestSession=this._requestSession,t._attachments=[...this._attachments],t._sdkProcessingMetadata={...this._sdkProcessingMetadata},t._propagationContext={...this._propagationContext},t._client=this._client,t._lastEventId=this._lastEventId,rn(t,an(this)),t}setClient(e){this._client=e}setLastEventId(e){this._lastEventId=e}getClient(){return this._client}lastEventId(){return this._lastEventId}addScopeListener(e){this._scopeListeners.push(e)}addEventProcessor(e){return this._eventProcessors.push(e),this}setUser(e){return this._user=e||{email:void 0,id:void 0,ip_address:void 0,username:void 0},this._session&&$t(this._session,{user:e}),this._notifyScopeListeners(),this}getUser(){return this._user}getRequestSession(){return this._requestSession}setRequestSession(e){return this._requestSession=e,this}setTags(e){return this._tags={...this._tags,...e},this._notifyScopeListeners(),this}setTag(e,t){return this._tags={...this._tags,[e]:t},this._notifyScopeListeners(),this}setExtras(e){return this._extra={...this._extra,...e},this._notifyScopeListeners(),this}setExtra(e,t){return this._extra={...this._extra,[e]:t},this._notifyScopeListeners(),this}setFingerprint(e){return this._fingerprint=e,this._notifyScopeListeners(),this}setLevel(e){return this._level=e,this._notifyScopeListeners(),this}setTransactionName(e){return this._transactionName=e,this._notifyScopeListeners(),this}setContext(e,t){return t===null?delete this._contexts[e]:this._contexts[e]=t,this._notifyScopeListeners(),this}setSession(e){return e?this._session=e:delete this._session,this._notifyScopeListeners(),this}getSession(){return this._session}update(e){if(!e)return this;let t=typeof e==`function`?e(this):e,[n,r]=t instanceof sn?[t.getScopeData(),t.getRequestSession()]:l(t)?[e,e.requestSession]:[],{tags:i,extra:a,user:o,contexts:s,level:c,fingerprint:u=[],propagationContext:d}=n||{};return this._tags={...this._tags,...i},this._extra={...this._extra,...a},this._contexts={...this._contexts,...s},o&&Object.keys(o).length&&(this._user=o),c&&(this._level=c),u.length&&(this._fingerprint=u),d&&(this._propagationContext=d),r&&(this._requestSession=r),this}clear(){return this._breadcrumbs=[],this._tags={},this._extra={},this._user={},this._contexts={},this._level=void 0,this._transactionName=void 0,this._fingerprint=void 0,this._requestSession=void 0,this._session=void 0,rn(this,void 0),this._attachments=[],this._propagationContext=Kt(),this._notifyScopeListeners(),this}addBreadcrumb(e,t){let n=typeof t==`number`?t:on;if(n<=0)return this;let r={timestamp:He(),...e},i=this._breadcrumbs;return i.push(r),this._breadcrumbs=i.length>n?i.slice(-n):i,this._notifyScopeListeners(),this}getLastBreadcrumb(){return this._breadcrumbs[this._breadcrumbs.length-1]}clearBreadcrumbs(){return this._breadcrumbs=[],this._notifyScopeListeners(),this}addAttachment(e){return this._attachments.push(e),this}clearAttachments(){return this._attachments=[],this}getScopeData(){return{breadcrumbs:this._breadcrumbs,attachments:this._attachments,contexts:this._contexts,tags:this._tags,extra:this._extra,user:this._user,level:this._level,fingerprint:this._fingerprint||[],eventProcessors:this._eventProcessors,propagationContext:this._propagationContext,sdkProcessingMetadata:this._sdkProcessingMetadata,transactionName:this._transactionName,span:an(this)}}setSDKProcessingMetadata(e){return this._sdkProcessingMetadata={...this._sdkProcessingMetadata,...e},this}setPropagationContext(e){return this._propagationContext=e,this}getPropagationContext(){return this._propagationContext}captureException(e,t){let n=t&&t.event_id?t.event_id:rt();if(!this._client)return F.warn(`No client configured on scope - will not capture exception!`),n;let r=Error(`Sentry syntheticException`);return this._client.captureException(e,{originalException:e,syntheticException:r,...t,event_id:n},this),n}captureMessage(e,t,n){let r=n&&n.event_id?n.event_id:rt();if(!this._client)return F.warn(`No client configured on scope - will not capture message!`),r;let i=Error(e);return this._client.captureMessage(e,t,{originalException:e,syntheticException:i,...n,event_id:r},this),r}captureEvent(e,t){let n=t&&t.event_id?t.event_id:rt();return this._client?(this._client.captureEvent(e,{...t,event_id:n},this),n):(F.warn(`No client configured on scope - will not capture event!`),n)}_notifyScopeListeners(){this._notifyingListeners||=(this._notifyingListeners=!0,this._scopeListeners.forEach(e=>{e(this)}),!1)}};function cn(){return O(`defaultCurrentScope`,()=>new sn)}function ln(){return O(`defaultIsolationScope`,()=>new sn)}var un=class{constructor(e,t){let n;n=e||new sn;let r;r=t||new sn,this._stack=[{scope:n}],this._isolationScope=r}withScope(e){let t=this._pushScope(),n;try{n=e(t)}catch(e){throw this._popScope(),e}return p(n)?n.then(e=>(this._popScope(),e),e=>{throw this._popScope(),e}):(this._popScope(),n)}getClient(){return this.getStackTop().client}getScope(){return this.getStackTop().scope}getIsolationScope(){return this._isolationScope}getStackTop(){return this._stack[this._stack.length-1]}_pushScope(){let e=this.getScope().clone();return this._stack.push({client:this.getClient(),scope:e}),e}_popScope(){return this._stack.length<=1?!1:!!this._stack.pop()}};function dn(){let e=Zt(Xt());return e.stack=e.stack||new un(cn(),ln())}function fn(e){return dn().withScope(e)}function pn(e,t){let n=dn();return n.withScope(()=>(n.getStackTop().scope=e,t(e)))}function mn(e){return dn().withScope(()=>e(dn().getIsolationScope()))}function hn(){return{withIsolationScope:mn,withScope:fn,withSetScope:pn,withSetIsolationScope:(e,t)=>mn(t),getCurrentScope:()=>dn().getScope(),getIsolationScope:()=>dn().getIsolationScope()}}function gn(e){let t=Zt(e);return t.acs?t.acs:hn()}function _n(){return gn(Xt()).getCurrentScope()}function vn(){return gn(Xt()).getIsolationScope()}function yn(){return O(`globalScope`,()=>new sn)}function bn(...e){let t=gn(Xt());if(e.length===2){let[n,r]=e;return n?t.withSetScope(n,r):t.withScope(r)}return t.withScope(e[0])}function xn(){return _n().getClient()}var Sn=`_sentryMetrics`;function Cn(e){let t=e[Sn];if(!t)return;let n={};for(let[,[e,r]]of t)(n[e]||(n[e]=[])).push(be(r));return n}var wn=`sentry.source`,Tn=`sentry.sample_rate`,En=`sentry.op`,Dn=`sentry.origin`;function On(e){let{spanId:t,traceId:n}=e.spanContext(),{parent_span_id:r}=jn(e);return be({parent_span_id:r,span_id:t,trace_id:n})}function kn(e){return typeof e==`number`?An(e):Array.isArray(e)?e[0]+e[1]/1e9:e instanceof Date?An(e.getTime()):We()}function An(e){return e>9999999999?e/1e3:e}function jn(e){if(Nn(e))return e.getSpanJSON();try{let{spanId:t,traceId:n}=e.spanContext();if(Mn(e)){let{attributes:r,startTime:i,name:a,endTime:o,parentSpanId:s,status:c}=e;return be({span_id:t,trace_id:n,data:r,description:a,parent_span_id:s,start_timestamp:kn(i),timestamp:kn(o)||void 0,status:Fn(c),op:r[En],origin:r[Dn],_metrics_summary:Cn(e)})}return{span_id:t,trace_id:n}}catch{return{}}}function Mn(e){let t=e;return!!t.attributes&&!!t.startTime&&!!t.name&&!!t.endTime&&!!t.status}function Nn(e){return typeof e.getSpanJSON==`function`}function Pn(e){let{traceFlags:t}=e.spanContext();return t===1}function Fn(e){if(!(!e||e.code===0))return e.code===1?`ok`:e.message||`unknown_error`}var In=`_sentryRootSpan`;function Ln(e){return e[In]||e}var Rn=`production`,zn=`_frozenDsc`;function Bn(e,t){let n=t.getOptions(),{publicKey:r}=t.getDsn()||{},i=be({environment:n.environment||`production`,release:n.release,public_key:r,trace_id:e});return t.emit(`createDsc`,i),i}function Vn(e){let t=xn();if(!t)return{};let n=Bn(jn(e).trace_id||``,t),r=Ln(e),i=r[zn];if(i)return i;let a=r.spanContext().traceState,o=a&&a.get(`sentry.dsc`),s=o&&Et(o);if(s)return s;let c=jn(r),l=c.data||{},u=l[Tn];u!=null&&(n.sample_rate=`${u}`);let d=l[wn],f=c.description;return d!==`url`&&f&&(n.transaction=f),n.sampled=String(Pn(r)),t.emit(`createDsc`,n,r),n}function Hn(e){if(typeof e==`boolean`)return Number(e);let t=typeof e==`string`?parseFloat(e):e;if(typeof t!=`number`||isNaN(t)||t<0||t>1){Yt&&F.warn(`[Tracing] Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got ${JSON.stringify(e)} of type ${JSON.stringify(typeof e)}.`);return}return t}function Un(e,t){return t?(e.sdk=e.sdk||{},e.sdk.name=e.sdk.name||t.name,e.sdk.version=e.sdk.version||t.version,e.sdk.integrations=[...e.sdk.integrations||[],...t.integrations||[]],e.sdk.packages=[...e.sdk.packages||[],...t.packages||[]],e):e}function Wn(e,t,n,r){let i=Rt(n);return kt({sent_at:new Date().toISOString(),...i&&{sdk:i},...!!r&&t&&{dsn:I(t)}},[`aggregates`in e?[{type:`sessions`},e]:[{type:`session`},e.toJSON()]])}function Gn(e,t,n,r){let i=Rt(n),a=e.type&&e.type!==`replay_event`?e.type:`event`;Un(e,n&&n.sdk);let o=zt(e,i,r,t);return delete e.sdkProcessingMetadata,kt(o,[[{type:a},e]])}function Kn(e,t,n,r=0){return new bt((i,a)=>{let o=e[r];if(t===null||typeof o!=`function`)i(t);else{let s=o({...t},n);Yt&&o.id&&s===null&&F.log(`Event processor "${o.id}" dropped event`),p(s)?s.then(t=>Kn(e,t,n,r+1).then(i)).then(null,a):Kn(e,s,n,r+1).then(i).then(null,a)}})}function qn(e,t){let{fingerprint:n,span:r,breadcrumbs:i,sdkProcessingMetadata:a}=t;Xn(e,t),r&&$n(e,r),er(e,n),Zn(e,i),Qn(e,a)}function Jn(e,t){let{extra:n,tags:r,user:i,contexts:a,level:o,sdkProcessingMetadata:s,breadcrumbs:c,fingerprint:l,eventProcessors:u,attachments:d,propagationContext:f,transactionName:p,span:m}=t;Yn(e,`extra`,n),Yn(e,`tags`,r),Yn(e,`user`,i),Yn(e,`contexts`,a),Yn(e,`sdkProcessingMetadata`,s),o&&(e.level=o),p&&(e.transactionName=p),m&&(e.span=m),c.length&&(e.breadcrumbs=[...e.breadcrumbs,...c]),l.length&&(e.fingerprint=[...e.fingerprint,...l]),u.length&&(e.eventProcessors=[...e.eventProcessors,...u]),d.length&&(e.attachments=[...e.attachments,...d]),e.propagationContext={...e.propagationContext,...f}}function Yn(e,t,n){if(n&&Object.keys(n).length){e[t]={...e[t]};for(let r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[t][r]=n[r])}}function Xn(e,t){let{extra:n,tags:r,user:i,contexts:a,level:o,transactionName:s}=t,c=be(n);c&&Object.keys(c).length&&(e.extra={...c,...e.extra});let l=be(r);l&&Object.keys(l).length&&(e.tags={...l,...e.tags});let u=be(i);u&&Object.keys(u).length&&(e.user={...u,...e.user});let d=be(a);d&&Object.keys(d).length&&(e.contexts={...d,...e.contexts}),o&&(e.level=o),s&&e.type!==`transaction`&&(e.transaction=s)}function Zn(e,t){let n=[...e.breadcrumbs||[],...t];e.breadcrumbs=n.length?n:void 0}function Qn(e,t){e.sdkProcessingMetadata={...e.sdkProcessingMetadata,...t}}function $n(e,t){e.contexts={trace:On(t),...e.contexts},e.sdkProcessingMetadata={dynamicSamplingContext:Vn(t),...e.sdkProcessingMetadata};let n=jn(Ln(t)).description;n&&!e.transaction&&e.type===`transaction`&&(e.transaction=n)}function er(e,t){e.fingerprint=e.fingerprint?lt(e.fingerprint):[],t&&(e.fingerprint=e.fingerprint.concat(t)),e.fingerprint&&!e.fingerprint.length&&delete e.fingerprint}function tr(e,t,n,r,i,a){let{normalizeDepth:o=3,normalizeMaxBreadth:s=1e3}=e,c={...t,event_id:t.event_id||n.event_id||rt(),timestamp:t.timestamp||He()},l=n.integrations||e.integrations.map(e=>e.name);nr(c,e),or(c,l),i&&i.emit(`applyFrameMetadata`,t),t.type===void 0&&ir(c,e.stackParser);let u=cr(r,n.captureContext);n.mechanism&&st(c,n.mechanism);let d=i?i.getEventProcessors():[],f=yn().getScopeData();a&&Jn(f,a.getScopeData()),u&&Jn(f,u.getScopeData());let p=[...n.attachments||[],...f.attachments];return p.length&&(n.attachments=p),qn(c,f),Kn([...d,...f.eventProcessors],c,n).then(e=>(e&&ar(e),typeof o==`number`&&o>0?sr(e,o,s):e))}function nr(e,t){let{environment:n,release:r,dist:i,maxValueLength:a=250}=t;`environment`in e||(e.environment=`environment`in t?n:Rn),e.release===void 0&&r!==void 0&&(e.release=r),e.dist===void 0&&i!==void 0&&(e.dist=i),e.message&&=_(e.message,a);let o=e.exception&&e.exception.values&&e.exception.values[0];o&&o.value&&(o.value=_(o.value,a));let s=e.request;s&&s.url&&(s.url=_(s.url,a))}var rr=new WeakMap;function ir(e,t){let n=D._sentryDebugIds;if(!n)return;let r,i=rr.get(t);i?r=i:(r=new Map,rr.set(t,r));let a=Object.entries(n).reduce((e,[n,i])=>{let a,o=r.get(n);o?a=o:(a=t(n),r.set(n,a));for(let t=a.length-1;t>=0;t--){let n=a[t];if(n.filename){e[n.filename]=i;break}}return e},{});try{e.exception.values.forEach(e=>{e.stacktrace.frames.forEach(e=>{e.filename&&(e.debug_id=a[e.filename])})})}catch{}}function ar(e){let t={};try{e.exception.values.forEach(e=>{e.stacktrace.frames.forEach(e=>{e.debug_id&&(e.abs_path?t[e.abs_path]=e.debug_id:e.filename&&(t[e.filename]=e.debug_id),delete e.debug_id)})})}catch{}if(Object.keys(t).length===0)return;e.debug_meta=e.debug_meta||{},e.debug_meta.images=e.debug_meta.images||[];let n=e.debug_meta.images;Object.entries(t).forEach(([e,t])=>{n.push({type:`sourcemap`,code_file:e,debug_id:t})})}function or(e,t){t.length>0&&(e.sdk=e.sdk||{},e.sdk.integrations=[...e.sdk.integrations||[],...t])}function sr(e,t,n){if(!e)return null;let r={...e,...e.breadcrumbs&&{breadcrumbs:e.breadcrumbs.map(e=>({...e,...e.data&&{data:ut(e.data,t,n)}}))},...e.user&&{user:ut(e.user,t,n)},...e.contexts&&{contexts:ut(e.contexts,t,n)},...e.extra&&{extra:ut(e.extra,t,n)}};return e.contexts&&e.contexts.trace&&r.contexts&&(r.contexts.trace=e.contexts.trace,e.contexts.trace.data&&(r.contexts.trace.data=ut(e.contexts.trace.data,t,n))),e.spans&&(r.spans=e.spans.map(e=>({...e,...e.data&&{data:ut(e.data,t,n)}}))),r}function cr(e,t){if(!t)return e;let n=e?e.clone():new sn;return n.update(t),n}function lr(e){if(e)return ur(e)||fr(e)?{captureContext:e}:e}function ur(e){return e instanceof sn||typeof e==`function`}var dr=[`user`,`level`,`extra`,`contexts`,`tags`,`fingerprint`,`requestSession`,`propagationContext`];function fr(e){return Object.keys(e).some(e=>dr.includes(e))}function pr(e,t){return _n().captureException(e,lr(t))}function mr(e,t){return _n().captureEvent(e,t)}function hr(e){let t=xn(),n=vn(),r=_n(),{release:i,environment:a=Rn}=t&&t.getOptions()||{},{userAgent:o}=D.navigator||{},s=Qt({release:i,environment:a,user:r.getUser()||n.getUser(),...o&&{userAgent:o},...e}),c=n.getSession();return c&&c.status===`ok`&&$t(c,{status:`exited`}),gr(),n.setSession(s),r.setSession(s),s}function gr(){let e=vn(),t=_n(),n=t.getSession()||e.getSession();n&&en(n),_r(),e.setSession(),t.setSession()}function _r(){let e=vn(),t=_n(),n=xn(),r=t.getSession()||e.getSession();r&&n&&n.captureSession(r)}function vr(e=!1){if(e){gr();return}_r()}var yr=`7`;function br(e){let t=e.protocol?`${e.protocol}:`:``,n=e.port?`:${e.port}`:``;return`${t}//${e.host}${n}${e.path?`/${e.path}`:``}/api/`}function xr(e){return`${br(e)}${e.projectId}/envelope/`}function Sr(e,t){return ge({sentry_key:e.publicKey,sentry_version:yr,...t&&{sentry_client:`${t.name}/${t.version}`}})}function Cr(e,t,n){return t||`${xr(e)}?${Sr(e,n)}`}var wr=[];function Tr(e){let t={};return e.forEach(e=>{let{name:n}=e,r=t[n];r&&!r.isDefaultInstance&&e.isDefaultInstance||(t[n]=e)}),Object.values(t)}function Er(e){let t=e.defaultIntegrations||[],n=e.integrations;t.forEach(e=>{e.isDefaultInstance=!0});let r;r=Array.isArray(n)?[...t,...n]:typeof n==`function`?lt(n(t)):t;let i=Tr(r),a=i.findIndex(e=>e.name===`Debug`);if(a>-1){let[e]=i.splice(a,1);i.push(e)}return i}function Dr(e,t){let n={};return t.forEach(t=>{t&&kr(e,t,n)}),n}function Or(e,t){for(let n of t)n&&n.afterAllSetup&&n.afterAllSetup(e)}function kr(e,t,n){if(n[t.name]){Yt&&F.log(`Integration skipped because it was already installed: ${t.name}`);return}if(n[t.name]=t,wr.indexOf(t.name)===-1&&typeof t.setupOnce==`function`&&(t.setupOnce(),wr.push(t.name)),t.setup&&typeof t.setup==`function`&&t.setup(e),typeof t.preprocessEvent==`function`){let n=t.preprocessEvent.bind(t);e.on(`preprocessEvent`,(t,r)=>n(t,r,e))}if(typeof t.processEvent==`function`){let n=t.processEvent.bind(t),r=Object.assign((t,r)=>n(t,r,e),{id:t.name});e.addEventProcessor(r)}Yt&&F.log(`Integration installed: ${t.name}`)}function Ar(e){return e}var jr=`Not capturing exception because it's already been captured.`,Mr=class{constructor(e){if(this._options=e,this._integrations={},this._numProcessing=0,this._outcomes={},this._hooks={},this._eventProcessors=[],e.dsn?this._dsn=ue(e.dsn):Yt&&F.warn(`No DSN provided, client will not send events.`),this._dsn){let t=Cr(this._dsn,e.tunnel,e._metadata?e._metadata.sdk:void 0);this._transport=e.transport({tunnel:this._options.tunnel,recordDroppedEvent:this.recordDroppedEvent.bind(this),...e.transportOptions,url:t})}}captureException(e,t,n){let r=rt();if(ct(e))return Yt&&F.log(jr),r;let i={event_id:r,...t};return this._process(this.eventFromException(e,i).then(e=>this._captureEvent(e,i,n))),i.event_id}captureMessage(e,t,n,r){let i={event_id:rt(),...n},a=s(e)?e:String(e),o=c(e)?this.eventFromMessage(a,t,i):this.eventFromException(e,i);return this._process(o.then(e=>this._captureEvent(e,i,r))),i.event_id}captureEvent(e,t,n){let r=rt();if(t&&t.originalException&&ct(t.originalException))return Yt&&F.log(jr),r;let i={event_id:r,...t},a=(e.sdkProcessingMetadata||{}).capturedSpanScope;return this._process(this._captureEvent(e,i,a||n)),i.event_id}captureSession(e){typeof e.release==`string`?(this.sendSession(e),$t(e,{init:!1})):Yt&&F.warn(`Discarded session because of missing or non-string release`)}getDsn(){return this._dsn}getOptions(){return this._options}getSdkMetadata(){return this._options._metadata}getTransport(){return this._transport}flush(e){let t=this._transport;return t?(this.emit(`flush`),this._isClientDoneProcessing(e).then(n=>t.flush(e).then(e=>n&&e))):vt(!0)}close(e){return this.flush(e).then(e=>(this.getOptions().enabled=!1,this.emit(`close`),e))}getEventProcessors(){return this._eventProcessors}addEventProcessor(e){this._eventProcessors.push(e)}init(){(this._isEnabled()||this._options.integrations.some(({name:e})=>e.startsWith(`Spotlight`)))&&this._setupIntegrations()}getIntegrationByName(e){return this._integrations[e]}addIntegration(e){let t=this._integrations[e.name];kr(this,e,this._integrations),t||Or(this,[e])}sendEvent(e,t={}){this.emit(`beforeSendEvent`,e,t);let n=Gn(e,this._dsn,this._options._metadata,this._options.tunnel);for(let e of t.attachments||[])n=At(n,Ft(e));let r=this.sendEnvelope(n);r&&r.then(t=>this.emit(`afterSendEvent`,e,t),null)}sendSession(e){let t=Wn(e,this._dsn,this._options._metadata,this._options.tunnel);this.sendEnvelope(t)}recordDroppedEvent(e,t,n){if(this._options.sendClientReports){let r=typeof n==`number`?n:1,i=`${e}:${t}`;Yt&&F.log(`Recording outcome: "${i}"${r>1?` (${r} times)`:``}`),this._outcomes[i]=(this._outcomes[i]||0)+r}}on(e,t){let n=this._hooks[e]=this._hooks[e]||[];return n.push(t),()=>{let e=n.indexOf(t);e>-1&&n.splice(e,1)}}emit(e,...t){let n=this._hooks[e];n&&n.forEach(e=>e(...t))}sendEnvelope(e){return this.emit(`beforeEnvelope`,e),this._isEnabled()&&this._transport?this._transport.send(e).then(null,e=>(Yt&&F.error(`Error while sending event:`,e),e)):(Yt&&F.error(`Transport disabled`),vt({}))}_setupIntegrations(){let{integrations:e}=this._options;this._integrations=Dr(this,e),Or(this,e)}_updateSessionFromEvent(e,t){let n=!1,r=!1,i=t.exception&&t.exception.values;if(i){r=!0;for(let e of i){let t=e.mechanism;if(t&&t.handled===!1){n=!0;break}}}let a=e.status===`ok`;(a&&e.errors===0||a&&n)&&($t(e,{...n&&{status:`crashed`},errors:e.errors||Number(r||n)}),this.captureSession(e))}_isClientDoneProcessing(e){return new bt(t=>{let n=0,r=setInterval(()=>{this._numProcessing==0?(clearInterval(r),t(!0)):(n+=1,e&&n>=e&&(clearInterval(r),t(!1)))},1)})}_isEnabled(){return this.getOptions().enabled!==!1&&this._transport!==void 0}_prepareEvent(e,t,n,r=vn()){let i=this.getOptions(),a=Object.keys(this._integrations);return!t.integrations&&a.length>0&&(t.integrations=a),this.emit(`preprocessEvent`,e,t),e.type||r.setLastEventId(e.event_id||t.event_id),tr(i,e,t,n,this,r).then(e=>{if(e===null)return e;let t={...r.getPropagationContext(),...n?n.getPropagationContext():void 0};if(!(e.contexts&&e.contexts.trace)&&t){let{traceId:n,spanId:r,parentSpanId:i,dsc:a}=t;e.contexts={trace:be({trace_id:n,span_id:r,parent_span_id:i}),...e.contexts},e.sdkProcessingMetadata={dynamicSamplingContext:a||Bn(n,this),...e.sdkProcessingMetadata}}return e})}_captureEvent(e,t={},n){return this._processEvent(e,t,n).then(e=>e.event_id,e=>{if(Yt){let t=e;t.logLevel===`log`?F.log(t.message):F.warn(t)}})}_processEvent(e,t,n){let r=this.getOptions(),{sampleRate:i}=r,a=Ir(e),o=Fr(e),s=e.type||`error`,c=`before send for type \`${s}\``,l=i===void 0?void 0:Hn(i);if(o&&typeof l==`number`&&Math.random()>l)return this.recordDroppedEvent(`sample_rate`,`error`,e),yt(new de(`Discarding event because it's not included in the random sample (sampling rate = ${i})`,`log`));let u=s===`replay_event`?`replay`:s,d=(e.sdkProcessingMetadata||{}).capturedSpanIsolationScope;return this._prepareEvent(e,t,n,d).then(n=>{if(n===null)throw this.recordDroppedEvent(`event_processor`,u,e),new de("An event processor returned `null`, will not send event.",`log`);return t.data&&t.data.__sentry__===!0?n:Nr(Pr(this,r,n,t),c)}).then(r=>{if(r===null){if(this.recordDroppedEvent(`before_send`,u,e),a){let t=1+(e.spans||[]).length;this.recordDroppedEvent(`before_send`,`span`,t)}throw new de(`${c} returned \`null\`, will not send event.`,`log`)}let i=n&&n.getSession();if(!a&&i&&this._updateSessionFromEvent(i,r),a){let e=(r.sdkProcessingMetadata&&r.sdkProcessingMetadata.spanCountBeforeProcessing||0)-(r.spans?r.spans.length:0);e>0&&this.recordDroppedEvent(`before_send`,`span`,e)}let o=r.transaction_info;return a&&o&&r.transaction!==e.transaction&&(r.transaction_info={...o,source:`custom`}),this.sendEvent(r,t),r}).then(null,e=>{throw e instanceof de?e:(this.captureException(e,{data:{__sentry__:!0},originalException:e}),new de(`Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${e}`))})}_process(e){this._numProcessing++,e.then(e=>(this._numProcessing--,e),e=>(this._numProcessing--,e))}_clearOutcomes(){let e=this._outcomes;return this._outcomes={},Object.entries(e).map(([e,t])=>{let[n,r]=e.split(`:`);return{reason:n,category:r,quantity:t}})}_flushOutcomes(){Yt&&F.log(`Flushing outcomes...`);let e=this._clearOutcomes();if(e.length===0){Yt&&F.log(`No outcomes to send`);return}if(!this._dsn){Yt&&F.log(`No dsn provided, will not send outcomes`);return}Yt&&F.log(`Sending outcomes:`,e);let t=Bt(e,this._options.tunnel&&I(this._dsn));this.sendEnvelope(t)}};function Nr(e,t){let n=`${t} must return \`null\` or a valid event.`;if(p(e))return e.then(e=>{if(!l(e)&&e!==null)throw new de(n);return e},e=>{throw new de(`${t} rejected with ${e}`)});if(!l(e)&&e!==null)throw new de(n);return e}function Pr(e,t,n,r){let{beforeSend:i,beforeSendTransaction:a,beforeSendSpan:o}=t;if(Fr(n)&&i)return i(n,r);if(Ir(n)){if(n.spans&&o){let t=[];for(let r of n.spans){let n=o(r);n?t.push(n):e.recordDroppedEvent(`before_send`,`span`)}n.spans=t}if(a){if(n.spans){let e=n.spans.length;n.sdkProcessingMetadata={...n.sdkProcessingMetadata,spanCountBeforeProcessing:e}}return a(n,r)}}return n}function Fr(e){return e.type===void 0}function Ir(e){return e.type===`transaction`}function Lr(e,t){t.debug===!0&&(Yt?F.enable():ie(()=>{console.warn("[Sentry] Cannot initialize SDK with `debug` option using a non-debug bundle.")})),_n().update(t.initialScope);let n=new e(t);return Rr(n),n.init(),n}function Rr(e){_n().setClient(e)}function zr(e,t,n=xt(e.bufferSize||64)){let r={},i=e=>n.drain(e);function a(i){let a=[];if(jt(i,(t,n)=>{let i=Lt(n);if(Wt(r,i)){let r=Br(t,n);e.recordDroppedEvent(`ratelimit_backoff`,i,r)}else a.push(t)}),a.length===0)return vt({});let o=kt(i[0],a),s=t=>{jt(o,(n,r)=>{let i=Br(n,r);e.recordDroppedEvent(t,Lt(r),i)})};return n.add(()=>t({body:Nt(o)}).then(e=>(e.statusCode!==void 0&&(e.statusCode<200||e.statusCode>=300)&&Yt&&F.warn(`Sentry responded with status code ${e.statusCode} to sent event.`),r=Gt(r,e),e),e=>{throw s(`network_error`),e})).then(e=>e,e=>{if(e instanceof de)return Yt&&F.error(`Skipped sending event because buffer is full.`),s(`queue_overflow`),vt({});throw e})}return{send:a,flush:i}}function Br(e,t){if(!(t!==`event`&&t!==`transaction`))return Array.isArray(e)?e[1]:void 0}function Vr(e,t,n=[t],r=`npm`){let i=e._metadata||{};i.sdk||={name:`sentry.javascript.${t}`,packages:n.map(e=>({name:`${r}:@sentry/${e}`,version:E})),version:E},e._metadata=i}var Hr=100;function Ur(e,t){let n=xn(),r=vn();if(!n)return;let{beforeBreadcrumb:i=null,maxBreadcrumbs:a=Hr}=n.getOptions();if(a<=0)return;let o={timestamp:He(),...e},s=i?ie(()=>i(o,t)):o;s!==null&&(n.emit&&n.emit(`beforeAddBreadcrumb`,s,t),r.addBreadcrumb(s,a))}var Wr,Gr=`FunctionToString`,Kr=new WeakMap,qr=Ar((()=>({name:Gr,setupOnce(){Wr=Function.prototype.toString;try{Function.prototype.toString=function(...e){let t=he(this),n=Kr.has(xn())&&t!==void 0?t:this;return Wr.apply(n,e)}}catch{}},setup(e){Kr.set(e,!0)}}))),Jr=[/^Script error\.?$/,/^Javascript error: Script error\.? on line 0$/,/^ResizeObserver loop completed with undelivered notifications.$/,/^Cannot redefine property: googletag$/,`undefined is not an object (evaluating 'a.L')`,`can't redefine non-configurable property "solana"`,`vv().getRestrictions is not a function. (In 'vv().getRestrictions(1,a)', 'vv().getRestrictions' is undefined)`,`Can't find variable: _AutofillCallbackHandler`],Yr=`InboundFilters`,Xr=Ar(((e={})=>({name:Yr,processEvent(t,n,r){return Qr(t,Zr(e,r.getOptions()))?null:t}})));function Zr(e={},t={}){return{allowUrls:[...e.allowUrls||[],...t.allowUrls||[]],denyUrls:[...e.denyUrls||[],...t.denyUrls||[]],ignoreErrors:[...e.ignoreErrors||[],...t.ignoreErrors||[],...e.disableErrorDefaults?[]:Jr],ignoreTransactions:[...e.ignoreTransactions||[],...t.ignoreTransactions||[]],ignoreInternal:e.ignoreInternal===void 0?!0:e.ignoreInternal}}function Qr(e,t){return t.ignoreInternal&&ii(e)?(Yt&&F.warn(`Event dropped due to being internal Sentry Error.\nEvent: ${at(e)}`),!0):$r(e,t.ignoreErrors)?(Yt&&F.warn(`Event dropped due to being matched by \`ignoreErrors\` option.\nEvent: ${at(e)}`),!0):si(e)?(Yt&&F.warn(`Event dropped due to not having an error message, error type or stacktrace.\nEvent: ${at(e)}`),!0):ei(e,t.ignoreTransactions)?(Yt&&F.warn(`Event dropped due to being matched by \`ignoreTransactions\` option.\nEvent: ${at(e)}`),!0):ti(e,t.denyUrls)?(Yt&&F.warn(`Event dropped due to being matched by \`denyUrls\` option.\nEvent: ${at(e)}.\nUrl: ${oi(e)}`),!0):ni(e,t.allowUrls)?!1:(Yt&&F.warn(`Event dropped due to not being matched by \`allowUrls\` option.\nEvent: ${at(e)}.\nUrl: ${oi(e)}`),!0)}function $r(e,t){return e.type||!t||!t.length?!1:ri(e).some(e=>b(e,t))}function ei(e,t){if(e.type!==`transaction`||!t||!t.length)return!1;let n=e.transaction;return n?b(n,t):!1}function ti(e,t){if(!t||!t.length)return!1;let n=oi(e);return n?b(n,t):!1}function ni(e,t){if(!t||!t.length)return!0;let n=oi(e);return n?b(n,t):!0}function ri(e){let t=[];e.message&&t.push(e.message);let n;try{n=e.exception.values[e.exception.values.length-1]}catch{}return n&&n.value&&(t.push(n.value),n.type&&t.push(`${n.type}: ${n.value}`)),t}function ii(e){try{return e.exception.values[0].type===`SentryError`}catch{}return!1}function ai(e=[]){for(let t=e.length-1;t>=0;t--){let n=e[t];if(n&&n.filename!==`<anonymous>`&&n.filename!==`[native code]`)return n.filename||null}return null}function oi(e){try{let t;try{t=e.exception.values[0].stacktrace.frames}catch{}return t?ai(t):null}catch{return Yt&&F.error(`Cannot extract url for event ${at(e)}`),null}}function si(e){return e.type||!e.exception||!e.exception.values||e.exception.values.length===0?!1:!e.message&&!e.exception.values.some(e=>e.stacktrace||e.type&&e.type!==`Error`||e.value)}var ci=`Dedupe`,li=Ar((()=>{let e;return{name:ci,processEvent(t){if(t.type)return t;try{if(ui(t,e))return Yt&&F.warn(`Event dropped due to being a duplicate of previously captured event.`),null}catch{}return e=t}}}));function ui(e,t){return t?!!(di(e,t)||fi(e,t)):!1}function di(e,t){let n=e.message,r=t.message;return!(!n&&!r||n&&!r||!n&&r||n!==r||!mi(e,t)||!pi(e,t))}function fi(e,t){let n=hi(t),r=hi(e);return!(!n||!r||n.type!==r.type||n.value!==r.value||!mi(e,t)||!pi(e,t))}function pi(e,t){let n=ke(e),r=ke(t);if(!n&&!r)return!0;if(n&&!r||!n&&r||(n=n,r=r,r.length!==n.length))return!1;for(let e=0;e<r.length;e++){let t=r[e],i=n[e];if(t.filename!==i.filename||t.lineno!==i.lineno||t.colno!==i.colno||t.function!==i.function)return!1}return!0}function mi(e,t){let n=e.fingerprint,r=t.fingerprint;if(!n&&!r)return!0;if(n&&!r||!n&&r)return!1;n=n,r=r;try{return n.join(``)===r.join(``)}catch{return!1}}function hi(e){return e.exception&&e.exception.values&&e.exception.values[0]}var gi=D,_i=0;function vi(){return _i>0}function yi(){_i++,setTimeout(()=>{_i--})}function bi(e,t={},n){if(typeof e!=`function`)return e;try{let t=e.__sentry_wrapped__;if(t)return t;if(he(e))return e}catch{return e}let r=function(){let r=Array.prototype.slice.call(arguments);try{n&&typeof n==`function`&&n.apply(this,arguments);let i=r.map(e=>bi(e,t));return e.apply(this,i)}catch(e){throw yi(),bn(n=>{n.addEventProcessor(e=>(t.mechanism&&(ot(e,void 0,void 0),st(e,t.mechanism)),e.extra={...e.extra,arguments:r},e)),pr(e)}),e}};try{for(let t in e)Object.prototype.hasOwnProperty.call(e,t)&&(r[t]=e[t])}catch{}me(r,e),pe(e,`__sentry_wrapped__`,r);try{Object.getOwnPropertyDescriptor(r,`name`).configurable&&Object.defineProperty(r,`name`,{get(){return e.name}})}catch{}return r}var xi=typeof __SENTRY_DEBUG__>`u`||__SENTRY_DEBUG__;function Si(e,t){let n=Ti(e,t),r={type:t&&t.name,value:ki(t)};return n.length&&(r.stacktrace={frames:n}),r.type===void 0&&r.value===``&&(r.value=`Unrecoverable error caught`),r}function Ci(e,t,n,r){let i=xn(),a=i&&i.getOptions().normalizeDepth,o=Ii(t),s={__serialized__:dt(t,a)};if(o)return{exception:{values:[Si(e,o)]},extra:s};let c={exception:{values:[{type:u(t)?t.constructor.name:r?`UnhandledRejection`:`Error`,value:Pi(t,{isUnhandledRejection:r})}]},extra:s};if(n){let t=Ti(e,n);t.length&&(c.exception.values[0].stacktrace={frames:t})}return c}function wi(e,t){return{exception:{values:[Si(e,t)]}}}function Ti(e,t){let n=t.stacktrace||t.stack||``,r=Di(t),i=Oi(t);try{return e(n,r,i)}catch{}return[]}var Ei=/Minified React error #\d+;/i;function Di(e){return e&&Ei.test(e.message)?1:0}function Oi(e){return typeof e.framesToPop==`number`?e.framesToPop:0}function ki(e){let t=e&&e.message;return t?t.error&&typeof t.error.message==`string`?t.error.message:t:`No error message`}function Ai(e,t,n,r){let i=Mi(e,t,n&&n.syntheticException||void 0,r);return st(i),i.level=`error`,n&&n.event_id&&(i.event_id=n.event_id),vt(i)}function ji(e,t,n=`info`,r,i){let a=Ni(e,t,r&&r.syntheticException||void 0,i);return a.level=n,r&&r.event_id&&(a.event_id=r.event_id),vt(a)}function Mi(e,n,o,s,c){let d;if(r(n)&&n.error)return wi(e,n.error);if(i(n)||a(n)){let t=n;if(`stack`in n)d=wi(e,n);else{let n=t.name||(i(t)?`DOMError`:`DOMException`),r=t.message?`${n}: ${t.message}`:n;d=Ni(e,r,o,s),ot(d,r)}return`code`in t&&(d.tags={...d.tags,"DOMException.code":`${t.code}`}),d}return t(n)?wi(e,n):l(n)||u(n)?(d=Ci(e,n,o,c),st(d,{synthetic:!0}),d):(d=Ni(e,n,o,s),ot(d,`${n}`,void 0),st(d,{synthetic:!0}),d)}function Ni(e,t,n,r){let i={};if(r&&n){let r=Ti(e,n);r.length&&(i.exception={values:[{value:t,stacktrace:{frames:r}}]})}if(s(t)){let{__sentry_template_string__:e,__sentry_template_values__:n}=t;return i.logentry={message:e,params:n},i}return i.message=t,i}function Pi(e,{isUnhandledRejection:t}){let n=R(e),i=t?`promise rejection`:`exception`;return r(e)?`Event \`ErrorEvent\` captured as ${i} with message \`${e.message}\``:u(e)?`Event \`${Fi(e)}\` (type=${e.type}) captured as ${i}`:`Object captured as ${i} with keys: ${n}`}function Fi(e){try{let t=Object.getPrototypeOf(e);return t?t.constructor.name:void 0}catch{}}function Ii(e){for(let t in e)if(Object.prototype.hasOwnProperty.call(e,t)){let n=e[t];if(n instanceof Error)return n}}function Li(e,{metadata:t,tunnel:n,dsn:r}){return kt({event_id:e.event_id,sent_at:new Date().toISOString(),...t&&t.sdk&&{sdk:{name:t.sdk.name,version:t.sdk.version}},...!!n&&!!r&&{dsn:I(r)}},[Ri(e)])}function Ri(e){return[{type:`user_report`},e]}var zi=class extends Mr{constructor(e){let t={parentSpanIsAlwaysRootSpan:!0,...e};Vr(t,`browser`,[`browser`],gi.SENTRY_SDK_SOURCE||tt()),super(t),t.sendClientReports&&gi.document&&gi.document.addEventListener(`visibilitychange`,()=>{gi.document.visibilityState===`hidden`&&this._flushOutcomes()})}eventFromException(e,t){return Ai(this._options.stackParser,e,t,this._options.attachStacktrace)}eventFromMessage(e,t=`info`,n){return ji(this._options.stackParser,e,t,n,this._options.attachStacktrace)}captureUserFeedback(e){if(!this._isEnabled()){xi&&F.warn(`SDK not enabled, will not capture user feedback.`);return}let t=Li(e,{metadata:this.getSdkMetadata(),dsn:this.getDsn(),tunnel:this.getOptions().tunnel});this.sendEnvelope(t)}_prepareEvent(e,t,n){return e.platform=e.platform||`javascript`,super._prepareEvent(e,t,n)}},Bi=typeof __SENTRY_DEBUG__>`u`||__SENTRY_DEBUG__,Vi=D,Hi=1e3,Ui,Wi,Gi;function Ki(e){Me(`dom`,e),Ne(`dom`,qi)}function qi(){if(!Vi.document)return;let e=Pe.bind(null,`dom`),t=Xi(e,!0);Vi.document.addEventListener(`click`,t,!1),Vi.document.addEventListener(`keypress`,t,!1),[`EventTarget`,`Node`].forEach(t=>{let n=Vi[t]&&Vi[t].prototype;!n||!n.hasOwnProperty||!n.hasOwnProperty(`addEventListener`)||(fe(n,`addEventListener`,function(t){return function(n,r,i){if(n===`click`||n==`keypress`)try{let r=this,a=r.__sentry_instrumentation_handlers__=r.__sentry_instrumentation_handlers__||{},o=a[n]=a[n]||{refCount:0};if(!o.handler){let r=Xi(e);o.handler=r,t.call(this,n,r,i)}o.refCount++}catch{}return t.call(this,n,r,i)}}),fe(n,`removeEventListener`,function(e){return function(t,n,r){if(t===`click`||t==`keypress`)try{let n=this,i=n.__sentry_instrumentation_handlers__||{},a=i[t];a&&(a.refCount--,a.refCount<=0&&(e.call(this,t,a.handler,r),a.handler=void 0,delete i[t]),Object.keys(i).length===0&&delete n.__sentry_instrumentation_handlers__)}catch{}return e.call(this,t,n,r)}}))})}function Ji(e){if(e.type!==Wi)return!1;try{if(!e.target||e.target._sentryId!==Gi)return!1}catch{}return!0}function Yi(e,t){return e===`keypress`?!t||!t.tagName?!0:!(t.tagName===`INPUT`||t.tagName===`TEXTAREA`||t.isContentEditable):!1}function Xi(e,t=!1){return n=>{if(!n||n._sentryCaptured)return;let r=Zi(n);if(Yi(n.type,r))return;pe(n,`_sentryCaptured`,!0),r&&!r._sentryId&&pe(r,`_sentryId`,rt());let i=n.type===`keypress`?`input`:n.type;Ji(n)||(e({event:n,name:i,global:t}),Wi=n.type,Gi=r?r._sentryId:void 0),clearTimeout(Ui),Ui=Vi.setTimeout(()=>{Gi=void 0,Wi=void 0},Hi)}}function Zi(e){try{return e.target}catch{return null}}var Qi;function $i(e){let t=`history`;Me(t,e),Ne(t,ea)}function ea(){if(!Jt())return;let e=Vi.onpopstate;Vi.onpopstate=function(...t){let n=Vi.location.href,r=Qi;if(Qi=n,Pe(`history`,{from:r,to:n}),e)try{return e.apply(this,t)}catch{}};function t(e){return function(...t){let n=t.length>2?t[2]:void 0;if(n){let e=Qi,t=String(n);Qi=t,Pe(`history`,{from:e,to:t})}return e.apply(this,t)}}fe(Vi.history,`pushState`,t),fe(Vi.history,`replaceState`,t)}var ta={};function na(e){let t=ta[e];if(t)return t;let n=Vi[e];if(ze(n))return ta[e]=n.bind(Vi);let r=Vi.document;if(r&&typeof r.createElement==`function`)try{let t=r.createElement(`iframe`);t.hidden=!0,r.head.appendChild(t);let i=t.contentWindow;i&&i[e]&&(n=i[e]),r.head.removeChild(t)}catch(t){Bi&&F.warn(`Could not create sandbox iframe for ${e} check, bailing to window.${e}: `,t)}return n&&(ta[e]=n.bind(Vi))}function ra(e){ta[e]=void 0}var ia=`__sentry_xhr_v3__`;function aa(e){Me(`xhr`,e),Ne(`xhr`,oa)}function oa(){if(!Vi.XMLHttpRequest)return;let e=XMLHttpRequest.prototype;fe(e,`open`,function(e){return function(...t){let n=We()*1e3,r=o(t[0])?t[0].toUpperCase():void 0,i=sa(t[1]);if(!r||!i)return e.apply(this,t);this[ia]={method:r,url:i,request_headers:{}},r===`POST`&&i.match(/sentry_key/)&&(this.__sentry_own_request__=!0);let a=()=>{let e=this[ia];if(e&&this.readyState===4){try{e.status_code=this.status}catch{}Pe(`xhr`,{endTimestamp:We()*1e3,startTimestamp:n,xhr:this})}};return`onreadystatechange`in this&&typeof this.onreadystatechange==`function`?fe(this,`onreadystatechange`,function(e){return function(...t){return a(),e.apply(this,t)}}):this.addEventListener(`readystatechange`,a),fe(this,`setRequestHeader`,function(e){return function(...t){let[n,r]=t,i=this[ia];return i&&o(n)&&o(r)&&(i.request_headers[n.toLowerCase()]=r),e.apply(this,t)}}),e.apply(this,t)}}),fe(e,`send`,function(e){return function(...t){let n=this[ia];return n?(t[0]!==void 0&&(n.body=t[0]),Pe(`xhr`,{startTimestamp:We()*1e3,xhr:this}),e.apply(this,t)):e.apply(this,t)}})}function sa(e){if(o(e))return e;try{return e.toString()}catch{}}function ca(e,t=na(`fetch`)){let n=0,r=0;function i(i){let a=i.body.length;n+=a,r++;let o={body:i.body,method:`POST`,referrerPolicy:`origin`,headers:e.headers,keepalive:n<=6e4&&r<15,...e.fetchOptions};if(!t)return ra(`fetch`),yt(`No fetch implementation available`);try{return t(e.url,o).then(e=>(n-=a,r--,{statusCode:e.status,headers:{"x-sentry-rate-limits":e.headers.get(`X-Sentry-Rate-Limits`),"retry-after":e.headers.get(`Retry-After`)}}))}catch(e){return ra(`fetch`),n-=a,r--,yt(e)}}return zr(e,i)}var la=30,ua=50;function da(e,t,n,r){let i={filename:e,function:t===`<anonymous>`?`?`:t,in_app:!0};return n!==void 0&&(i.lineno=n),r!==void 0&&(i.colno=r),i}var fa=/^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i,pa=/^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,ma=/\((\S*)(?::(\d+))(?::(\d+))\)/,ha=[la,e=>{let t=fa.exec(e);if(t){let[,e,n,r]=t;return da(e,`?`,+n,+r)}let n=pa.exec(e);if(n){if(n[2]&&n[2].indexOf(`eval`)===0){let e=ma.exec(n[2]);e&&(n[2]=e[1],n[3]=e[2],n[4]=e[3])}let[e,t]=ya(n[1]||`?`,n[2]);return da(t,e,n[3]?+n[3]:void 0,n[4]?+n[4]:void 0)}}],ga=/^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i,_a=/(\S+) line (\d+)(?: > eval line \d+)* > eval/i,va=V(ha,[ua,e=>{let t=ga.exec(e);if(t){if(t[3]&&t[3].indexOf(` > eval`)>-1){let e=_a.exec(t[3]);e&&(t[1]=t[1]||`eval`,t[3]=e[1],t[4]=e[2],t[5]=``)}let e=t[3],n=t[1]||`?`;return[n,e]=ya(n,e),da(e,n,t[4]?+t[4]:void 0,t[5]?+t[5]:void 0)}}]),ya=(e,t)=>{let n=e.indexOf(`safari-extension`)!==-1,r=e.indexOf(`safari-web-extension`)!==-1;return n||r?[e.indexOf(`@`)===-1?`?`:e.split(`@`)[0],n?`safari-extension:${t}`:`safari-web-extension:${t}`]:[e,t]},ba=1024,xa=`Breadcrumbs`,Sa=Ar(((e={})=>{let t={console:!0,dom:!0,fetch:!0,history:!0,sentry:!0,xhr:!0,...e};return{name:xa,setup(e){t.console&&Fe(Ta(e)),t.dom&&Ki(wa(e,t.dom)),t.xhr&&aa(Ea(e)),t.fetch&&Ge(Da(e)),t.history&&$i(Oa(e)),t.sentry&&e.on(`beforeSendEvent`,Ca(e))}}}));function Ca(e){return function(t){xn()===e&&Ur({category:`sentry.${t.type===`transaction`?`transaction`:`event`}`,event_id:t.event_id,level:t.level,message:at(t)},{event:t})}}function wa(e,t){return function(n){if(xn()!==e)return;let r,i,a=typeof t==`object`?t.serializeAttribute:void 0,o=typeof t==`object`&&typeof t.maxStringLength==`number`?t.maxStringLength:void 0;o&&o>ba&&(xi&&F.warn(`\`dom.maxStringLength\` cannot exceed ${ba}, but a value of ${o} was configured. Sentry will use ${ba} instead.`),o=ba),typeof a==`string`&&(a=[a]);try{let e=n.event,t=ka(e)?e.target:e;r=j(t,{keyAttrs:a,maxStringLength:o}),i=te(t)}catch{r=`<unknown>`}if(r.length===0)return;let s={category:`ui.${n.name}`,message:r};i&&(s.data={"ui.component_name":i}),Ur(s,{event:n.event,name:n.name,global:n.global})}}function Ta(e){return function(t){if(xn()!==e)return;let n={category:`console`,data:{arguments:t.args,logger:`console`},level:wt(t.level),message:v(t.args,` `)};if(t.level===`assert`)if(t.args[0]===!1)n.message=`Assertion failed: ${v(t.args.slice(1),` `)||`console.assert`}`,n.data.arguments=t.args.slice(1);else return;Ur(n,{input:t.args,level:t.level})}}function Ea(e){return function(t){if(xn()!==e)return;let{startTimestamp:n,endTimestamp:r}=t,i=t.xhr[ia];if(!n||!r||!i)return;let{method:a,url:o,status_code:s,body:c}=i,l={method:a,url:o,status_code:s},u={xhr:t.xhr,input:c,startTimestamp:n,endTimestamp:r};Ur({category:`xhr`,data:l,type:`http`},u)}}function Da(e){return function(t){if(xn()!==e)return;let{startTimestamp:n,endTimestamp:r}=t;if(r&&!(t.fetchData.url.match(/sentry_key/)&&t.fetchData.method===`POST`))if(t.error){let e=t.fetchData,i={data:t.error,input:t.args,startTimestamp:n,endTimestamp:r};Ur({category:`fetch`,data:e,level:`error`,type:`http`},i)}else{let e=t.response,i={...t.fetchData,status_code:e&&e.status},a={input:t.args,response:e,startTimestamp:n,endTimestamp:r};Ur({category:`fetch`,data:i,type:`http`},a)}}}function Oa(e){return function(t){if(xn()!==e)return;let n=t.from,r=t.to,i=St(gi.location.href),a=n?St(n):void 0,o=St(r);(!a||!a.path)&&(a=i),i.protocol===o.protocol&&i.host===o.host&&(r=o.relative),i.protocol===a.protocol&&i.host===a.host&&(n=a.relative),Ur({category:`navigation`,data:{from:n,to:r}})}}function ka(e){return!!e&&!!e.target}var Aa=`EventTarget.Window.Node.ApplicationCache.AudioTrackList.BroadcastChannel.ChannelMergerNode.CryptoOperation.EventSource.FileReader.HTMLUnknownElement.IDBDatabase.IDBRequest.IDBTransaction.KeyOperation.MediaController.MessagePort.ModalWindow.Notification.SVGElementInstance.Screen.SharedWorker.TextTrack.TextTrackCue.TextTrackList.WebSocket.WebSocketWorker.Worker.XMLHttpRequest.XMLHttpRequestEventTarget.XMLHttpRequestUpload`.split(`.`),ja=`BrowserApiErrors`,Ma=Ar(((e={})=>{let t={XMLHttpRequest:!0,eventTarget:!0,requestAnimationFrame:!0,setInterval:!0,setTimeout:!0,...e};return{name:ja,setupOnce(){t.setTimeout&&fe(gi,`setTimeout`,Na),t.setInterval&&fe(gi,`setInterval`,Na),t.requestAnimationFrame&&fe(gi,`requestAnimationFrame`,Pa),t.XMLHttpRequest&&`XMLHttpRequest`in gi&&fe(XMLHttpRequest.prototype,`send`,Fa);let e=t.eventTarget;e&&(Array.isArray(e)?e:Aa).forEach(Ia)}}}));function Na(e){return function(...t){let n=t[0];return t[0]=bi(n,{mechanism:{data:{function:Oe(e)},handled:!1,type:`instrument`}}),e.apply(this,t)}}function Pa(e){return function(t){return e.apply(this,[bi(t,{mechanism:{data:{function:`requestAnimationFrame`,handler:Oe(e)},handled:!1,type:`instrument`}})])}}function Fa(e){return function(...t){let n=this;return[`onload`,`onerror`,`onprogress`,`onreadystatechange`].forEach(e=>{e in n&&typeof n[e]==`function`&&fe(n,e,function(t){let n={mechanism:{data:{function:e,handler:Oe(t)},handled:!1,type:`instrument`}},r=he(t);return r&&(n.mechanism.data.handler=Oe(r)),bi(t,n)})}),e.apply(this,t)}}function Ia(e){let t=gi,n=t[e]&&t[e].prototype;!n||!n.hasOwnProperty||!n.hasOwnProperty(`addEventListener`)||(fe(n,`addEventListener`,function(t){return function(n,r,i){try{typeof r.handleEvent==`function`&&(r.handleEvent=bi(r.handleEvent,{mechanism:{data:{function:`handleEvent`,handler:Oe(r),target:e},handled:!1,type:`instrument`}}))}catch{}return t.apply(this,[n,bi(r,{mechanism:{data:{function:`addEventListener`,handler:Oe(r),target:e},handled:!1,type:`instrument`}}),i])}}),fe(n,`removeEventListener`,function(e){return function(t,n,r){let i=n;try{let n=i&&i.__sentry_wrapped__;n&&e.call(this,t,n,r)}catch{}return e.call(this,t,i,r)}}))}var La=`GlobalHandlers`,Ra=Ar(((e={})=>{let t={onerror:!0,onunhandledrejection:!0,...e};return{name:La,setupOnce(){Error.stackTraceLimit=50},setup(e){t.onerror&&(za(e),Wa(`onerror`)),t.onunhandledrejection&&(Ba(e),Wa(`onunhandledrejection`))}}}));function za(e){Xe(t=>{let{stackParser:n,attachStacktrace:r}=Ga();if(xn()!==e||vi())return;let{msg:i,url:a,line:o,column:s,error:c}=t,l=Ua(Mi(n,c||i,void 0,r,!1),a,o,s);l.level=`error`,mr(l,{originalException:c,mechanism:{handled:!1,type:`onerror`}})})}function Ba(e){$e(t=>{let{stackParser:n,attachStacktrace:r}=Ga();if(xn()!==e||vi())return;let i=Va(t),a=c(i)?Ha(i):Mi(n,i,void 0,r,!0);a.level=`error`,mr(a,{originalException:i,mechanism:{handled:!1,type:`onunhandledrejection`}})})}function Va(e){if(c(e))return e;try{if(`reason`in e)return e.reason;if(`detail`in e&&`reason`in e.detail)return e.detail.reason}catch{}return e}function Ha(e){return{exception:{values:[{type:`UnhandledRejection`,value:`Non-Error promise rejection captured with value: ${String(e)}`}]}}}function Ua(e,t,n,r){let i=e.exception=e.exception||{},a=i.values=i.values||[],s=a[0]=a[0]||{},c=s.stacktrace=s.stacktrace||{},l=c.frames=c.frames||[],u=isNaN(parseInt(r,10))?void 0:r,d=isNaN(parseInt(n,10))?void 0:n,f=o(t)&&t.length>0?t:M();return l.length===0&&l.push({colno:u,filename:f,function:`?`,in_app:!0,lineno:d}),e}function Wa(e){xi&&F.log(`Global Handler attached: ${e}`)}function Ga(){let e=xn();return e&&e.getOptions()||{stackParser:()=>[],attachStacktrace:!1}}var Ka=Ar(()=>({name:`HttpContext`,preprocessEvent(e){if(!gi.navigator&&!gi.location&&!gi.document)return;let t=e.request&&e.request.url||gi.location&&gi.location.href,{referrer:n}=gi.document||{},{userAgent:r}=gi.navigator||{},i={...e.request&&e.request.headers,...n&&{Referer:n},...r&&{"User-Agent":r}};e.request={...e.request,...t&&{url:t},headers:i}}})),qa=`cause`,Ja=5,Ya=`LinkedErrors`,Xa=Ar(((e={})=>{let t=e.limit||Ja,n=e.key||qa;return{name:Ya,preprocessEvent(e,r,i){let a=i.getOptions();x(Si,a.stackParser,a.maxValueLength,n,t,e,r)}}}));function Za(e){return[Xr(),qr(),Ma(),Sa(),Ra(),Xa(),li(),Ka()]}function Qa(e={}){let t={defaultIntegrations:Za(),release:typeof __SENTRY_RELEASE__==`string`?__SENTRY_RELEASE__:gi.SENTRY_RELEASE&&gi.SENTRY_RELEASE.id?gi.SENTRY_RELEASE.id:void 0,autoSessionTracking:!0,sendClientReports:!0};return e.defaultIntegrations??delete e.defaultIntegrations,{...t,...e}}function $a(){let e=gi.window!==void 0&&gi;if(!e)return!1;let t=e[e.chrome?`chrome`:`browser`],n=t&&t.runtime&&t.runtime.id,r=gi.location&&gi.location.href||``,i=!!n&&gi===gi.top&&[`chrome-extension:`,`moz-extension:`,`ms-browser-extension:`,`safari-web-extension:`].some(e=>r.startsWith(`${e}//`)),a=e.nw!==void 0;return!!n&&!i&&!a}function eo(e={}){let t=Qa(e);if($a()){ie(()=>{console.error(`[Sentry] You cannot run Sentry this way in a browser extension, check: https://docs.sentry.io/platforms/javascript/best-practices/browser-extensions/`)});return}xi&&(Re()||F.warn(`No Fetch API detected. The Sentry SDK requires a Fetch API compatible environment to send events. Please add a Fetch API polyfill.`));let n=Lr(zi,{...t,stackParser:we(t.stackParser||va),integrations:Er(t),transport:t.transport||ca});return t.autoSessionTracking&&to(),n}function to(){if(gi.document===void 0){xi&&F.warn(`Session tracking in non-browser environment with @sentry/browser is not supported.`);return}hr({ignoreDuration:!0}),vr(),$i(({from:e,to:t})=>{e!==void 0&&e!==t&&(hr({ignoreDuration:!0}),vr())})}eo({dsn:`https://7d9671463431e10775c66852b238ad8e@o4511337089400832.ingest.us.sentry.io/4511346247532544`,tracesSampleRate:.1,maxBreadcrumbs:30});function no(){if(typeof window>`u`)return!1;if(window.DEBUG)return!0;try{let e=new URLSearchParams(window.location.search).get(`debug`);if(e!==null&&e!==`0`&&e!==`false`||typeof localStorage<`u`&&(localStorage.getItem(`debug`)===`true`||localStorage.getItem(`debug`)===`1`))return!0}catch{}return!1}var ro={isDebug:no,info:(...e)=>{no()&&console.log(...e)},warn:(...e)=>{console.warn(...e)},error:(...e)=>{console.error(...e)}},io={};(function(e){let t=()=>{let e=new Date,t=e.getFullYear(),n=String(e.getMonth()+1).padStart(2,`0`),r=String(e.getDate()).padStart(2,`0`);return parseInt(t+n+r,10)},n=typeof window<`u`?new URLSearchParams(window.location.search):null,r=(e,t)=>{if(!n)return t;let r=n.get(e);return r===null?t:r};function i(e,t){if(e==null||e===``)return null;let n=e.trim(),r=n.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([NnSsEeWw][a-zA-Z]*)?$/);if(!r){let e=parseFloat(n);return isNaN(e)?null:e}let i=parseFloat(r[1]),a=r[2]?r[2].charAt(0).toUpperCase():null;if(isNaN(i))return null;if(a)if(t){if(a===`S`)return-Math.abs(i);if(a===`N`)return Math.abs(i)}else{if(a===`W`)return-Math.abs(i);if(a===`E`)return Math.abs(i)}return i}let a=i(r(`lat`,null),!0),o=i(r(`long`,r(`lon`,null)),!1),s=r(`alt`,null),c=s!==null&&s!==``?parseFloat(s):null,l=c!==null&&!isNaN(c)?c:null,u=parseInt(r(`seed`,t()),10),d=r(`theme`,`standard`),f=r(`cloud`,r(`clouds`,r(`cloudCover`,r(`overcast`,null)))),p=!0,m=null;if(f!==null&&f!==``){let e=f.trim().toLowerCase();if([`none`,`false`,`off`].includes(e))p=!1,m=0;else if(e===`auto`)p=!0,m=null;else if(e===`clear`)p=!0,m=0;else if(e===`scattered`)p=!0,m=.3;else if(e===`broken`)p=!0,m=.6;else if(e===`overcast`)p=!0,m=1;else{let t=parseFloat(e);isNaN(t)||(p=!0,m=Math.max(0,Math.min(1,t)))}}let h=r(`cloudHeight`,r(`cloudAlt`,r(`cloudCeiling`,null))),g=h!==null&&h!==``?parseFloat(h):null,_=g!==null&&!isNaN(g)?Math.max(500,Math.min(1e4,g)):3e3,v=r(`cloudSpeed`,null),y=v!==null&&v!==``?parseFloat(v):null,b=y!==null&&!isNaN(y)?Math.max(0,Math.min(20,y)):1,x=!0;if(r(`objects`,null)===`none`)x=!1;else if(typeof window<`u`&&window.localStorage){let e=window.localStorage.getItem(`chill_flight_show_objects`);e!==null&&(x=e===`true`)}let S=r(`map`,null),C=r(`palette`,null),w=r(`zenith`,null),T=r(`horizon`,null),E=r(`day`,r(`dayBlue`,r(`dayblue`,r(`day_blue`,r(`dayColor`,null))))),D=parseFloat(r(`scale`,`1.0`)),O=r(`freecam`,`false`)===`true`||r(`freeCamera`,`false`)===`true`,k=r(`debug`,null),A=k===``||k===`1`||k!==null&&k.trim().toLowerCase()===`true`,j=r(`autopilot`,r(`autoPilot`,r(`auto`,null))),ee=j===``||j===`1`||j!==null&&[`true`,`yes`,`on`,`1`].includes(j.trim().toLowerCase()),M=r(`minimap`,r(`miniMap`,r(`mapOverlay`,null))),te=M===``||M===`1`||M!==null&&[`true`,`yes`,`on`,`1`].includes(M.trim().toLowerCase()),N=r(`fullscreenmap`,r(`fullscreenMap`,r(`fullscreen-map`,r(`worldmap`,r(`worldMap`,r(`world-map`,null)))))),P=r(`map`,null),ne=i(r(`mapLat`,r(`maplat`,null)),!0),re=i(r(`mapLon`,r(`maplon`,r(`mapLong`,r(`maplong`,null)))),!1),ie=r(`mapX`,r(`mapx`,null)),ae=ie!==null&&ie!==``?parseFloat(ie):null,F=r(`mapZ`,r(`mapz`,null)),oe=F!==null&&F!==``?parseFloat(F):null,se=r(`mapZoom`,r(`mapzoom`,r(`zoom`,r(`mapRadius`,null)))),I=se!==null&&se!==``?parseFloat(se):null,L=I!==null&&!isNaN(I)&&I>0?I:null,ce=ne!==null||re!==null||ae!==null&&!isNaN(ae)||oe!==null&&!isNaN(oe)||L!==null,le=!(N!==null&&[`false`,`off`,`0`,`no`].includes(N.trim().toLowerCase()))&&ce||N===``||N===`1`||N!==null&&[`true`,`yes`,`on`,`1`].includes(N.trim().toLowerCase())||P!==null&&[`fullscreen`,`full`,`world`].includes(P.trim().toLowerCase()),ue=r(`x`,null),de=ue!==null&&ue!==``?parseFloat(ue):null,fe=r(`y`,null),pe=fe!==null&&fe!==``?parseFloat(fe):null,me=r(`z`,null),he=me!==null&&me!==``?parseFloat(me):null,ge=r(`heading`,null),_e=ge!==null&&ge!==``?parseFloat(ge):null,ve=r(`pitch`,null),ye=ve!==null&&ve!==``?parseFloat(ve):null,R=r(`speed`,null),be=R!==null&&R!==``?parseFloat(R):null,xe=r(`tod`,null),Se=xe!==null&&xe!==``?parseFloat(xe):null,z=r(`timeSpeed`,null),Ce=z!==null&&z!==``?parseFloat(z):null,B=r(`weather`,null),V=null;if(B!==null&&B!==``){let e=B.trim().toLowerCase();e===`clear`?V=`none`:[`auto`,`none`,`snow`,`rain`].includes(e)&&(V=e)}let we=r(`propLod`,r(`lod`,null)),Te=we!==null&&we!==``?parseFloat(we):null,Ee=r(`benchmark`,null),De=Ee!==null&&Ee!==``?parseFloat(Ee):null,Oe=r(`preset`,r(`graphics`,null)),ke=Oe!==null&&Oe!==``?Oe.toLowerCase():null,Ae=r(`islandType`,r(`island`,null)),je=`auto`;if(Ae!==null&&Ae!==``){let e=Ae.trim().toLowerCase();[`auto`,`temperate`,`subtropical`,`arid`,`alien`,`winter`].includes(e)&&(je=e)}let Me=[`classic`,`biplane`,`glider`,`twin`],Ne=r(`plane`,r(`vehicle`,null)),Pe=null;if(Ne!==null&&Ne!==``){let e=Ne.trim().toLowerCase();Me.includes(e)&&(Pe=e)}let Fe=je;function Ie(t,n,r){let i=e!==void 0&&e.FORCE_ISLAND_TYPE?e.FORCE_ISLAND_TYPE:io!==void 0&&io.FORCE_ISLAND_TYPE?io.FORCE_ISLAND_TYPE:Fe;if(i&&i!==`auto`)return i;if(t<=3e3)return`none`;if(!r)return`standard`;let a=r.noise2D(t*4e-5+8191,n*4e-5+8191);return a<-.15?`karst`:a>.15?`atoll`:`caldera`}function Le(e){return function(){e|=0,e=e+1831565813|0;var t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function Re(e,t){return Le(u*1000003^e*374761393+t*1234567891)}let ze=[13725034,4691099,8035966,8811945,6062226,15254402,10967674,3355443];function Be(e){if(!e)return ze[0];let t=0;for(let n=0;n<e.length;n++)t=e.charCodeAt(n)+((t<<5)-t);return ze[Math.abs(t)%ze.length]}function Ve(e,t=.71){let n=e%360/360,r=[[0,0],[.0417,.1458],[.375,.3333],[.5,.5],[.625,.6667],[.9583,.8542],[1,1]];for(let e=0;e<r.length-1;e++){let[t,i]=r[e],[a,o]=r[e+1];if(n>=t&&n<=a)return i+(n-t)/(a-t)*(o-i)}return n}function He(e,t,n,r){return{x:e/n*2-1,y:-(t/r)*2+1}}function Ue(e){let t=[`N`,`NW`,`W`,`SW`,`S`,`SE`,`E`,`NE`],n=e%(Math.PI*2);n<0&&(n+=Math.PI*2);let r=180/Math.PI*n;return t[Math.floor((r+22.5)%360/45)]}let We=12e4,Ge=We/(Math.PI*2);function H(e,t){let n=e/We*Math.PI*2;return t(Math.cos(n)*Ge,Math.sin(n)*Ge)}function Ke(e,t,n){let r=H(e,(e,r)=>n.noise3D(e*5e-5+1e3,t*5e-5+1e3,r*5e-5+1e3))*.5,i=1e4,a=0;if(e>0&&(a-=Math.min(1,e/i)),t>0){let r=Math.min(1,t/i);if(e<0){let t=Math.max(0,Math.min(1,1+e/5e3));r*=t}else if(e>0){let i=Math.max(0,Math.min(1,(t-8e3)/4e3)),a=Math.abs(t-3e3),o=Math.max(0,1-a/2500),s=5e3+i*25e3+o*3e3,c=Math.max(0,Math.min(1,1-e/s)),l=Math.min(1,e/5e3),u=H(e,(e,r)=>n.noise3D(e*15e-5,t*15e-5,r*15e-5))*.5*l*i;c=Math.max(0,Math.min(1,c+u)),r*=c}a+=r}return Math.max(-1,Math.min(1,a+r))}function qe(t,n,r,i,a,o={}){let s=i.WATER_LEVEL||40;function c(e,t=.8){if(e===0)return`major_river`;let n=r.noise2D(e*t,1234.5)*1.5;return n>.4?`mountain`:n<-.4?`minor_river`:`buffer`}let{MAP_WORLD_SIZE:l=5e3}=i,u=a||function(e,t,n){return e+(t-e)*n};if(e.customMap){let{data:r,width:i,height:a}=e.customMap,o=e.customMap.worldWidth||l,c=e.customMap.worldHeight||l,d=t/o+.5,f=n/c+.5;if(d<0||d>1||f<0||f>1)return 30;let p=d*(i-1),m=f*(a-1),h=Math.floor(p),g=Math.min(h+1,i-1),_=Math.floor(m),v=Math.min(_+1,a-1);h=Math.max(0,Math.min(h,i-1)),g=Math.max(0,Math.min(g,i-1)),_=Math.max(0,Math.min(_,a-1)),v=Math.max(0,Math.min(v,a-1));let y=p-h,b=m-_,x=r[_*i+h],S=r[_*i+g],C=r[v*i+h],w=r[v*i+g];return x===void 0||S===void 0||C===void 0||w===void 0?s:38+u(u(x,S,y),u(C,w,y),b)/255*87.5}let d=t,f=n,p=1e3,m=H(t,(e,t)=>r.noise3D(e*2e-4,n*2e-4,t*2e-4))*p,h=H(t,(e,t)=>r.noise3D(e*2e-4,n*2e-4+123.4,t*2e-4))*p;t+=m,n+=h;let g=Ke(t,n,r),_=150,v=60,y=50,b=10,x=Math.max(0,Math.min(1,-t/4500)),S=1;g<-.1&&(S=Math.max(0,1-(-.1-g)*4),S**=2);let C=Math.max(0,Math.min(1,(t+2e3)/2e3));if(C>0&&g<.1&&g>-.3){let e=1-(1-Math.abs(g+.1)/.2)*.8*C;_*=e,y*=e,b*=e}if(g<-.2){let e=Math.min(1,(-.2-g)*3);v=u(60,-55,e),_=u(150,100,e),y=u(50,20,e)}else if(g>.2){let e=Math.min(1,(g-.2)*3);v=u(60,20,e),_=u(150,250,e),y=u(50,100,e),b=u(10,30,e)}if(t<0){_*=1-x*.4,v=u(v,120,x);let e=H(t,(e,t)=>r.noise3D(e*3e-4,n*3e-4,t*3e-4))*140;v+=e*x,y*=1-x*.85,b*=1-x*.95}let w=H(t,(e,t)=>r.noise3D(e*.001,n*.001,t*.001))*_*S;if(g>.2){let e=Math.min(1,(g-.2)*3),i=1-Math.abs(H(t,(e,t)=>r.noise3D(e*8e-4,n*8e-4,t*8e-4)));w+=(i*220-100)*e*(1-x)}if(w+=H(t,(e,t)=>r.noise3D(e*.003,n*.003,t*.003))*y*S,w+=H(t,(e,t)=>r.noise3D(e*.01,n*.01,t*.01))*b*S,g<-.4){let e=H(t,(e,t)=>r.noise3D(e*2e-4,n*2e-4,t*2e-4));if(e>.4){let i=H(t,(e,t)=>r.noise3D(e*.005,n*.005,t*.005));i>0&&(w+=i*80*(e-.4)*2*S)}}if(w+=v,t>3e3){let e=Math.max(0,Math.min(1,-g*5)),i=(t-7500)*(t-7500)+(n-3e3)*(n-3e3),a=4e3,o=1;if(i<a*a){let e=Math.sqrt(i)/a;o=e*e*(3-2*e)}let c=e*o;if(c>0){let e=H(t,(e,t)=>r.noise3D(e*1e-4+500,n*1e-4+500,t*1e-4+500));if(e>.1){let i=H(t,(e,t)=>r.noise3D(e*5e-4,n*5e-4,t*5e-4))*500,a=H(t,(e,t)=>r.noise3D(e*5e-4+100,n*5e-4+100,t*5e-4+100))*500,o=H(t,(e,t)=>r.noise3D((e+i)*3e-4+1e3,(n+a)*3e-4+1e3,(t+i)*3e-4+1e3));if(o>-.2){let i=Math.min(1,(t-3e3)/7e3),a=Math.max(0,o+.2),l=a*(e-.1)*i*c;if(l>0){let o=Ie(t,n,r);if(o===`karst`){let i=Math.min(1,a*3)*50*l,o=H(t,(e,t)=>r.noise3D(e*.0012,n*.0012,t*.0012))*160,s=H(t,(e,t)=>r.noise3D(e*.0012+45.6,n*.0012+45.6,t*.0012+45.6))*160,c=H(t,(e,t)=>r.noise3D((e+o)*75e-5+300,(n+s)*75e-5+300,(t+o)*75e-5+300)),u=0;if(c>.02){let e=Math.min(1,(c-.02)/.98);u=e**.42*(1-(Math.max(0,e-.65)/.35)**2*.28)*1250*l;let t=Math.sin(u*.05)*14*(1-e);u+=t}let d=H(t,(e,t)=>r.noise3D(e*.002+777,n*.002+777,t*.002+777));if(d>.42){let t=(d-.42)/.58;u+=t**.35*380*l*Math.max(0,e-.05)*4}let f=H(t,(e,t)=>r.noise3D(e*.0035,n*.0035,t*.0035))*45*l;w+=i+u+f}else if(o===`caldera`){let e=.46,i=950*l,o=1-Math.abs(H(t,(e,t)=>r.noise3D(e*.0014,n*.0014,t*.0014))),s=o*o*140*l,c=H(t,(e,t)=>r.noise3D(e*75e-5+111,n*75e-5+111,t*75e-5+111))*110*l,u=H(t,(e,t)=>r.noise3D(e*45e-5+500,n*45e-5+500,t*45e-5+500)),d=Math.max(0,u-.28)*350*l,f=Math.min(1,a*2.2)*220*l,p;if(a<=e){let t=a/e;p=t**1.25*(i+c)+s*t-d*t}else{let t=Math.min(1,(a-e)/(.85-e)),n=i+c-d,r=n- -30*l;if(p=n-t**1.15*r,t>.55){let e=((t-.55)/.45)**1.8*180*l;p+=e}}let m=H(t,(e,t)=>r.noise3D(e*.003,n*.003,t*.003))*35*l;w+=f+p+m}else if(o===`atoll`){let o=Math.min(1,a/.16),u=o*o*(3-2*o),d=(e-.1)*i*c,f=u*Math.max(0,s-2-w)*Math.min(1,d*3),p=.42,m=Math.abs(a-p),h=Math.max(0,1-m/.35),g=h*h*(3-2*h),_=H(t,(e,t)=>r.noise3D(e*.0018+444,n*.0018+444,t*.0018+444)),v=Math.max(0,_+.15),y=g*(10+v*24)*Math.min(1,d*2.5),b=H(t,(e,t)=>r.noise3D(e*.0032+222,n*.0032+222,t*.0032+222)),x=1-Math.abs(b),S=(Math.max(0,x-.22)/.78)**1.2*g*Math.max(0,v-.05)*650*l,C=0;if(a>.54){let e=Math.min(1,(a-.54)/.38),i=H(t,(e,t)=>r.noise3D(e*.003+555,n*.003+555,t*.003+555)),o=1-Math.abs(i);o>.28&&(C=((o-.28)/.72)**.7*e**.75*1150*l)}let T=0;if(a>p){let e=Math.min(1,(a-p)/.15),i=Math.min(1,C/80);if(T=e*e*5.5*(1-i),a>.65){let e=H(t,(e,t)=>r.noise3D(e*.0025+888,n*.0025+888,t*.0025+888));e>.25&&(T-=((e-.25)/.75)**1.5*11)}}let E=H(t,(e,t)=>r.noise3D(e*.006,n*.006,t*.006))*3*g;w+=f+y+S+C-T+E}else{let e=1-Math.abs(H(t,(e,t)=>r.noise3D(e*.001,n*.001,t*.001))),i=e*e,a=l*600;a+=i*1200*l,a+=H(t,(e,t)=>r.noise3D(e*.003,n*.003,t*.003))*150*l,w+=a}}}}}}if(t<-3e3){let e=H(t,(e,t)=>r.noise3D(e*1e-4+200,n*1e-4+200,t*1e-4+200));if(e>.2){let i=H(t,(e,t)=>r.noise3D(e*3e-4+300,n*3e-4+300,t*3e-4+300));if(i>-.1){let a=Math.min(1,(-t-3e3)/7e3),o=Math.max(0,i+.1)*(e-.2)*a;if(o>0){let e=o*800;if(o>.1&&H(t,(e,t)=>r.noise3D(e*1e-4+500,n*1e-4+500,t*1e-4+500))>.2){let i=H(t,(e,t)=>r.noise3D(e*.002+600,n*.002+600,t*.002+600));if(i>.5){let t=(i-.5)*4e3;e-=t}}w-=e}}}}w<s-10&&(w=s-10);let T=5e3,E=Math.round(n/T),D=.8;for(let e=E-1;e<=E+1;e++){if(c(e,D)!==`mountain`)continue;let i=-2500,a=e*T,l=e;if(t<i){let e=a+H(t,(e,t)=>r.noise3D(e*1e-4+l*100,123,t*1e-4+l*100))*2e3,c=.5+H(t,(e,t)=>r.noise3D(e*2e-4+l*50,789,t*2e-4+l*50))*.5,u=i-t,d=Math.min(1,u/5e3),f=n-e,p=Math.abs(f),m=f>=0?1:-1,h=t*.8+m*p*.6,g=9e-4,_=(1-Math.abs(H(h,(e,t)=>r.noise3D(e*g+l*23.7,p*4e-4+127.3,t*g+l*23.7))))**1.4,v=o.forRoad?0:(_-.45)*650*Math.min(1,p/800),y=Math.max(0,p-v),b=2600,x=Math.exp(-(y*y)/(2*b*b));if(x>.01){let e=2200,i=(1-Math.min(e,y)/e)**1.7,a=0;!o.forRoad&&p>600&&p<2200&&(a=Math.sin((p-600)/1600*Math.PI)*(Math.max(0,.45-_)*2.2)*160);let u=0;if(!o.forRoad&&p>400&&p<2500){let e=Math.sin((p-400)/2100*Math.PI);u=_*200*e}let f=0;if(p>1e3&&p<3800){let e=(3800-p)/2800,i=e*e*(3-2*e),a=H(t,(e,t)=>r.noise3D(e*8e-4+l*31.2,n*8e-4+l*54.1,t*8e-4+l*31.2))*.65+H(t,(e,t)=>r.noise3D(e*.0018+73.1,n*.0018+89.2,t*.0018+73.1))*.35;f=Math.max(0,a+.15)*150*i}let m;if(o.forRoad)m=.25;else{let e=H(t,(e,t)=>r.noise3D(e*4e-4+l*12.3,n*4e-4,t*4e-4+l*12.3))*350,i=H(t,(e,t)=>r.noise3D(e*4e-4,n*4e-4+l*34.5,t*4e-4))*350,a=t+e,o=n+i,s=1-Math.abs(H(a,(e,t)=>r.noise3D(e*7e-4,o*7e-4,t*7e-4)));s**=1.3;let c=1-Math.abs(H(a,(e,t)=>r.noise3D(e*.0016+127.1,o*.0016+311.7,t*.0016+127.1)));c**=1.4;let u=1-Math.abs(H(a,(e,t)=>r.noise3D(e*.0035+241.3,o*.0035+189.5,t*.0035+241.3)));m=s*.6+c*.28*s+u*.12*(s*.5+.5)}let h=(240*x+f+Math.max(0,1600*i*m*(.4+.6*c)+u-a))*d,g=Math.min(1,Math.max(0,w-s)/15),v=H(t,(e,t)=>r.noise3D(e*12e-5+l*77,n*12e-5+l*88,t*12e-5+l*77)),b=Math.max(0,Math.min(1,(v+.5)*5));(g>.3||h>25)&&(w+=h*b)}}}let O=d- -5e3,k=f-5e3,A=O*O+k*k,j=1200;if(A<j*j*4){let e=(Math.sqrt(A)+H(d,(e,t)=>r.noise3D(e*5e-4,f*5e-4,t*5e-4))*200)**2,t=1400*Math.exp(-e/(2*700*700)),n=Math.atan2(k,O),i=1-Math.abs(r.noise2D(Math.cos(n)*5,Math.sin(n)*5)),a=Math.exp(-e/(2*560*560))*(1-Math.exp(-e/(280*140)));t+=i*150*a;let o=400*Math.exp(-A/12800),c=Math.exp(-A/28800);w=u(w,0,c),w+=t-o,w>s&&w<s+1.5&&(w=s)}if(!o.ignoreRivers){let i=0;for(let a=E-1;a<=E+1;a++){let o=c(a,D);if(o===`major_river`||o===`minor_river`){let s=e.getRiverCenterZ?e.getRiverCenterZ(t,n,r,a):a*T,c=Math.abs(n-s),l,u;if(o===`major_river`){let e=(H(t,(e,t)=>r.noise3D(e*5e-4,200,t*5e-4))+1)*.5;l=120+e*180,u=100+e*100}else{let e=(H(t,(e,t)=>r.noise3D(e*8e-4,a*10,t*8e-4))+1)*.5;l=100+e*100,u=60+e*40}let d=0;if(c<=l)d=1;else if(c<l+u){let e=(c-l)/u;d=1-e*e*(3-2*e)}d>i&&(i=d)}}if(i>0&&w>s-5){let e=s-5;w=Math.min(w,u(w,e,i))}}if(!o.ignoreRoads&&d<0){let e=et(f,Math.max(0,Math.round((d-Xe)/Ze)));if(e<0){let t=Math.abs(d-e);if(t<3550){let n=qe(e,f,r,i,u,{ignoreRivers:!0,ignoreRoads:!0,forRoad:!0}),a=s+60,o=a+(n-a)*.35;o=Math.max(o,a),o=Math.min(o,440);let c=250+Math.max(0,n-o)*1.5;if(t<50+c&&w>o){let e;if(t<=50)e=1;else{let n=(t-50)/c;e=1-n*n*(3-2*n)}e>0&&(w=u(w,o-2.5,e))}}}}let ee=5e4;if(t>ee&&t<75e3){let e=Math.min(1,(t-ee)/3e3),i=e*e*(3-2*e),a=Math.min(1,Math.max(0,(75e3-t)/1e4));i*=a;let o=Math.max(.3,i)*3e3,c=H(t,(e,t)=>r.noise3D(e*2e-4,n*2e-4+77.3,t*2e-4))*o,l=H(t,(e,t)=>r.noise3D(e*2e-4+33.1,n*2e-4,t*2e-4+33.1))*o,d=H(t,(e,t)=>r.noise3D((e+c)*15e-5,(n+l)*15e-5+11.5,(t+c)*15e-5))*o*.5,f=H(t,(e,t)=>r.noise3D((e+c)*15e-5+55.2,(n+l)*15e-5,(t+c)*15e-5+55.2))*o*.5,p=H(t,(e,t)=>r.noise3D((e+c)*8e-4,(n+l)*8e-4+91.2,(t+c)*8e-4))*500,m=H(t,(e,t)=>r.noise3D((e+c)*8e-4+41.8,(n+l)*8e-4,(t+c)*8e-4+41.8))*500,h=t+c+d+p,g=n+l+f+m,_=H(h,(e,t)=>r.noise3D(e*3e-4,g*3e-4,t*3e-4));if(_>.05){let e=Math.min(1,(_-.05)*4),t=1-Math.abs(H(h,(e,t)=>r.noise3D(e*6e-4,g*6e-4,t*6e-4))),n=1-Math.abs(H(h,(e,t)=>r.noise3D(e*.0012,g*.0012,t*.0012))),a=t*.6+n*.25+_*.15,o=H(h,(e,t)=>r.noise3D(e*.003,g*.003,t*.003))*40*e,s=u(260,600,i);w+=(a*s+o+25)*e*i}else{let e=Math.min(1,-_*2.5),t=e*e*(3-2*e);w>s-10&&(w=Math.max(s-10,w+(s-10-w)*t*i))}w<s-10&&(w=s-10)}else if(t>=75e3){let e=Math.min(1,(t-75e3)/25e3),i=Math.min(1,(t-75e3)/2500),a=t+H(t,(e,t)=>r.noise3D(e*6e-4+99,n*6e-4+99,t*6e-4+99))*800,o=n+H(t,(e,t)=>r.noise3D(e*6e-4-33,n*6e-4-33,t*6e-4-33))*800,c=H(a,(e,t)=>r.noise3D(e*1e-4+55,o*1e-4+55,t*1e-4+55)),l=120-e*160+c*80,d=1-Math.abs(H(a,(e,t)=>r.noise3D(e*3e-4+222,o*3e-4+222,t*3e-4+222)));if(d>.7){let e=((d-.7)/.3)**2*200;l-=e}if(H(t,(e,t)=>r.noise3D(e*2e-4+444,n*2e-4+444,t*2e-4+444))>.3){let e=H(a,(e,t)=>r.noise3D(e*.0015+222,o*.0015+222,t*.0015+222));if(e>.3){let t=((e-.3)/.7)**1.5*300;l+=t}}let f=Math.abs(l-s);if(f<15){let e=1-f/15,t=e*e*(3-2*e);l=u(l,s-2,t*.6);let n=1-Math.abs(H(a,(e,t)=>r.noise3D(e*.001+444,o*.001+444,t*.001+444)));if(n>.85){let e=((n-.85)/.15)**2*12;l+=e*t}}if(l>s-5){let e=H(a,(e,t)=>r.noise3D(e*.004+11,o*.004+11,t*.004+11))*30;l+=e}if(e>=1){let e=Math.min(1,(t-1e5)/1e4);l=u(l,30,e)}w=u(w,l,i),w<s-10&&(w=s-10)}else if(t<-ee&&t>-75e3){let e=Math.min(1,(-t-ee)/15e3),i=e*e*(3-2*e),a=Math.min(1,Math.max(0,(t+75e3)/1e4));i*=a;let o=Math.floor(w/120)*120,c=Math.min(1,Math.max(0,w%120/(120*.1)));o+=c*120,w=u(w,o,i*.8);let l=H(t,(e,t)=>r.noise3D(e*.0015,n*.0015,t*.0015));if(l>.5){let e=((l-.5)*2)**3*3e3;w+=e*i}let d=Math.abs(H(t,(e,t)=>r.noise3D(e*8e-4,n*8e-4,t*8e-4))),f=Math.abs(H(t,(e,t)=>r.noise3D(e*8e-4+100,n*8e-4+100,t*8e-4+100))),p=Math.min(d,f);if(p<.05){let e=(1-p/.05)**3*800;w-=e*i}w<s-10&&(w=s-10)}else if(t<=-75e3){let e=Math.min(1,(-t-75e3)/25e3),i=Math.min(1,(-t-75e3)/2500),a=t+H(t,(e,t)=>r.noise3D(e*6e-4+88,n*6e-4+88,t*6e-4+88))*800,o=n+H(t,(e,t)=>r.noise3D(e*6e-4-44,n*6e-4-44,t*6e-4-44))*800,c=H(a,(e,t)=>r.noise3D(e*1e-4,o*1e-4,t*1e-4)),l=120-e*160+c*80,d=1-Math.abs(H(a,(e,t)=>r.noise3D(e*3e-4+200,o*3e-4+200,t*3e-4+200)));if(d>.7){let e=((d-.7)/.3)**2*200;l-=e}if(H(t,(e,t)=>r.noise3D(e*2e-4+555,n*2e-4+555,t*2e-4+555))>.3){let e=H(a,(e,t)=>r.noise3D(e*.0015+111,o*.0015+111,t*.0015+111));if(e>.3){let t=((e-.3)/.7)**1.5*300;l+=t}}let f=Math.abs(l-s);if(f<15){let e=1-f/15,t=e*e*(3-2*e);l=u(l,s-2,t*.6);let n=1-Math.abs(H(a,(e,t)=>r.noise3D(e*.001+333,o*.001+333,t*.001+333)));if(n>.85){let e=((n-.85)/.15)**2*12;l+=e*t}}if(l>s-5){let e=H(a,(e,t)=>r.noise3D(e*.004,o*.004,t*.004))*30;l+=e}if(e>=1){let e=Math.min(1,(-t-1e5)/1e4);l=u(l,30,e)}w=u(w,l,i),w<s-10&&(w=s-10)}w<s-10&&(w=s-10);let M=!1,te=-2e4+H(t,(e,t)=>r.noise3D(e*2e-4,n*2e-4,t*2e-4))*2e3;if(n<te){let e=Math.min(1,(te-n)/3e3);if(e>0){let i=s+3+Math.abs(H(t,(e,t)=>r.noise3D(e*5e-4,n*5e-4,t*5e-4)))*4;if(e>H(t,(e,t)=>r.noise3D(e*5e-4,n*5e-4,t*5e-4))*.5+.5&&w<i){w=i,M=!0;let a=Math.abs(H(t,(e,t)=>r.noise3D(e*.0012,n*.0012,t*.0012)))*6,o=H(t,(e,t)=>r.noise3D(e*.0028+314,n*.0028+159,t*.0028+314)),s=(Math.max(0,1-Math.abs(o)-.25)/.75)**1.4*14,c=H(t,(e,t)=>r.noise3D(e*.006,n*.006,t*.006))*2;w+=(a+s+c)*e}}}return!M&&t<=8e3&&g>=-.2&&C>0&&w>s&&w<s+15&&(w=s+((w-s)/15)**1.3*15),w}e.customMap=null,e.WORLD_SEED=u,e.mulberry32=Le,e.chunkRng=Re,e.PLANE_COLORS=ze,e.getPlaneColor=Be,e.computeTimeOfDay=Ve,e.computeInputPosition=He,e.computeHeadingDirection=Ue;function Je(e,t,n,r=null){let i=5e3,a=r===null?Math.round(t/i):r,o=a*i,s=a*12.34,c=H(e,(e,t)=>n.noise3D(e*2e-5,s+50,t*2e-5))*5e3;o+=c;let l=(H(e,(e,t)=>n.noise3D(e*5e-5,s+100,t*5e-5))+1)*.5;if(a===0){let t=1e-4,r=1500+l*2500,i=2e-4,a=500+l*800;return o+H(e,(e,r)=>n.noise3D(e*t,0,r*t))*r+H(e,(e,t)=>n.noise3D(e*i,100,t*i))*a}else{let t=15e-5,r=1e3+l*2e3,i=3e-4,a=300+l*600;return o+H(e,(e,r)=>n.noise3D(e*t,s,r*t))*r+H(e,(e,t)=>n.noise3D(e*i,s+50,t*i))*a}}function Ye(e,t,n){let r=(t-e)%(Math.PI*2);return r<-Math.PI&&(r+=Math.PI*2),r>Math.PI&&(r-=Math.PI*2),e+r*n}let Xe=-5e3,Ze=-1e4,Qe=null;e.setRoadNoise=e=>{Qe=e};function $e(e,t=0){let n=3e3,r=e+t*99999,i=Qe.noise2D(r*1e-4,777),a=500;if(t===0){let t=Math.abs(e-5e3);if(t<n){let e=1-t/n,r=e*e*(3-2*e);i=(1-r)*i+r*1,a=(1-r)*500+r*100}}let o=i*2500,s=Qe.noise2D(r*3e-4,888)*a,c=Qe.noise2D(r*.001,999)*100;return o+s+c}function et(e,t=0){return Xe+t*Ze+$e(e,t)}function tt(e,t){let n=et(t,Math.round((e-Xe)/Ze)),r=Math.abs(e-n);if(r<=30)return 1;if(r<=40){let e=(r-30)/10;return 1-e*e*(3-2*e)}return 0}e.getBiome=Ke,e.MAP_WIDTH=We,e.getElevation=qe,e.getRiverCenterZ=Je,e.getRoadCenterX=et,e.getRoadFactor=tt,e.ROAD_BASE_X=Xe,e.ROAD_SPACING=Ze,e.ROAD_WIDTH=30,e.ROAD_SHOULDER=10,e.MAX_HIGHWAY_HEIGHT=440,e.lerpAngle=Ye,e.urlParams=n,e.THEME=d,e.SHOW_CLOUDS=p,e.START_CLOUD_COVER=m,e.START_CLOUD_HEIGHT=_,e.START_CLOUD_SPEED=b,e.SHOW_OBJECTS=x,e.setShowObjects=t=>{e.SHOW_OBJECTS=t},e.MAP_NAME=S,e.PALETTE_INDEX=C,e.SCALE=D,e.parsedLat=a,e.parsedLon=o,e.parsedAlt=l,e.START_FREE_CAM=O,e.START_X=de,e.START_Y=pe,e.START_Z=he,e.START_HEADING=_e,e.START_PITCH=ye,e.START_SPEED=be,e.START_TOD=Se,e.START_TIME_SPEED=Ce,e.START_WEATHER=V,e.START_PROP_LOD=Te,e.START_DEBUG=A,e.START_AUTOPILOT=ee,e.START_MINIMAP=te,e.START_FULLSCREEN_MAP=le,e.parsedMapLat=ne,e.parsedMapLon=re,e.START_MAP_X=ae,e.START_MAP_Z=oe,e.START_MAP_ZOOM=L,e.START_BENCHMARK=De,e.GRAPHICS_PRESET=ke,e.ZENITH_COLOR=w,e.HORIZON_COLOR=T,e.DAY_COLOR=E,e.START_ISLAND_TYPE=je,e.FORCE_ISLAND_TYPE=Fe,e.getIslandArchetype=Ie,e.START_PLANE=Pe,e.PLANE_TYPES=Me;function nt({currentPitch:e,currentRoll:t,currentYaw:n,targetPitch:r,targetRoll:i,turningRoll:a,isBarrelRolling:o,isLooping:s,isClampedRoll:c,turnSpeed:l,delta:u}){let d=e,f=t,p=n,m=(e,t)=>{let n=e;for(;n>t+Math.PI;)n-=2*Math.PI;for(;n<t-Math.PI;)n+=2*Math.PI;return n},h=1-Math.exp(-l*60*u);s||(d=m(d,r),d+=(r-d)*h),o||(f=m(f,i),f+=(i-f)*h);let g=a;return o&&!c&&(g=0),g=Math.max(-Math.PI,Math.min(Math.PI,g)),p+=g*.025*u*60,{pitch:d,roll:f,yaw:p}}e.computeFlightRotation=nt})(io);var ao=localStorage.getItem(`chill_flight_color`),oo=io.START_SPEED,so=oo!==null&&!isNaN(oo)?Math.max(0,Math.min(10,oo)):1,co={SEGMENTS:40,RENDER_DISTANCE:2,PROP_LOD_DISTANCE:4200,timeOfDay:5.5/12*Math.PI,daySpeedMultiplier:io.START_TIME_SPEED===null?1:io.START_TIME_SPEED,planeColor:ao!==null&&!isNaN(parseInt(ao))?parseInt(ao):io.PLANE_COLORS[0],pontoonDeploymentProgress:0,isDeployingPontoons:!1,isRetractingPontoons:!1,_nextYaw:void 0,chunkQueue:[],_enableObjects:io.SHOW_OBJECTS,flightSpeedMultiplier:so,targetFlightSpeed:so,verticalVelocity:0,dismissLoadingScreen:void 0,mouseX:0,mouseY:0,mouseControlActive:!1,windowJustFocused:!1,currentControlScheme:void 0,joystickActive:!1,joystickTouchId:null,startPlaneTooltipShown:void 0,dismissStartPlaneTooltipFunc:null,stoppedStartTime:null,targetPitch:0,targetRoll:0,smoothedManeuverFactor:0,manualPitch:0,cameraMode:`follow`,cameraTransitionProgress:0,currentBirdEyeHeight:2e3,_cinematicStableHeading:0,isDoingImmelmann:!1,immelmannProgress:0,wasLooping:!1,wasDoingFullLoop:!1,wasBarrelRolling:!1,wasDoingFullBarrelRoll:!1,wasDoingImmelmann:!1,isPaused:!0,justResumed:!1,isVRPresenting:!1,latScale:5e3,currentLatDeg:0,currentLatRad:0,sunX:0,sunY:0,sunZ:0,moonX:0,moonY:0,moonZ:0,dayFactor:0,passedServerNow:0,secondsInCycle:0,currentWarpedProgress:0,isBarrelRolling:!1,isDoingFullBarrelRoll:!1,isClampedRoll:!1,isLooping:!1,isDoingFullLoop:!1,manualRollSpeed:4,manualLoopSpeed:2.5,sessionDistanceTravelled:0,previousPosition:null,lifetimeDistanceTravelled:void 0,distanceSinceLastSave:0,isIntroTransitionActive:!1,introTransitionStartTime:0,freeCamDeltaX:0,freeCamDeltaY:0,lastY:250,_deltaRingIndex:0,_deltaRingCount:0,_deltaRingSum:0,smoothedDelta:void 0,gyroEnabled:void 0,gyroBasePitch:null,gyroBaseRoll:null,maxFPS:60,frameMinDelay:void 0,lastFrameTime:0,_auroraSessionMax:0,isShootingStarActive:!1,forceShootingStar:!1,shootingStarProgress:0,shootingStarDuration:1,forceRainbow:!1,rainbowTimer:0,rainbowIntensity:0,wasRainClearing:!0,_basePixelRatio:void 0,_gameServerNow:void 0,_unfadedRainOpacity:void 0,_unfadedSnowOpacity:void 0,_weatherDebug:void 0,airplaneModel:void 0,propGroup:void 0,propGroups:void 0,autopilotEnabled:void 0,manualBaseFogDensity:void 0,manualPropLOD:void 0,manualTimeOfDay:void 0,isFreeCamera:!1,invertYAxis:!1},lo={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},uo={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},fo=1e3,po=1001,mo=1002,ho=1003,go=1004,_o=1005,vo=1006,yo=1007,bo=1008,xo=1009,So=1010,Co=1011,wo=1012,To=1013,Eo=1014,Do=1015,Oo=1016,ko=1017,Ao=1018,jo=1020,Mo=35902,No=35899,Po=1021,Fo=1022,Io=1023,Lo=1026,Ro=1027,zo=1028,Bo=1029,Vo=1030,Ho=1031,Uo=1033,Wo=33776,Go=33777,Ko=33778,qo=33779,Jo=35840,Yo=35841,Xo=35842,Zo=35843,Qo=36196,$o=37492,es=37496,ts=37488,ns=37489,rs=37490,is=37491,as=37808,os=37809,ss=37810,cs=37811,ls=37812,us=37813,ds=37814,fs=37815,ps=37816,ms=37817,hs=37818,gs=37819,_s=37820,vs=37821,ys=36492,bs=36494,xs=36495,Ss=36283,Cs=36284,ws=36285,Ts=36286,Es=2300,Ds=2301,Os=2302,ks=2303,As=2400,js=2401,Ms=2402,Ns=3200,Ps=3201,Fs=`srgb`,Is=`srgb-linear`,Ls=`linear`,Rs=`srgb`,zs=7680,Bs=35044,Vs=35048,Hs=2e3;function Us(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Ws(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Gs(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function Ks(){let e=Gs(`canvas`);return e.style.display=`block`,e}var qs={},Js=null;function Ys(...e){let t=`THREE.`+e.shift();Js?Js(`log`,t,...e):console.log(t,...e)}function Xs(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function U(...e){e=Xs(e);let t=`THREE.`+e.shift();if(Js)Js(`warn`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function W(...e){e=Xs(e);let t=`THREE.`+e.shift();if(Js)Js(`error`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Zs(...e){let t=e.join(` `);t in qs||(qs[t]=!0,U(...e))}function Qs(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var $s={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},ec=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},tc=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),nc=1234567,rc=Math.PI/180,ic=180/Math.PI;function ac(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(tc[e&255]+tc[e>>8&255]+tc[e>>16&255]+tc[e>>24&255]+`-`+tc[t&255]+tc[t>>8&255]+`-`+tc[t>>16&15|64]+tc[t>>24&255]+`-`+tc[n&63|128]+tc[n>>8&255]+`-`+tc[n>>16&255]+tc[n>>24&255]+tc[r&255]+tc[r>>8&255]+tc[r>>16&255]+tc[r>>24&255]).toLowerCase()}function oc(e,t,n){return Math.max(t,Math.min(n,e))}function sc(e,t){return(e%t+t)%t}function cc(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function lc(e,t,n){return e===t?0:(n-e)/(t-e)}function uc(e,t,n){return(1-n)*e+n*t}function dc(e,t,n,r){return uc(e,t,1-Math.exp(-n*r))}function fc(e,t=1){return t-Math.abs(sc(e,t*2)-t)}function pc(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function mc(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function hc(e,t){return e+Math.floor(Math.random()*(t-e+1))}function gc(e,t){return e+Math.random()*(t-e)}function _c(e){return e*(.5-Math.random())}function vc(e){e!==void 0&&(nc=e);let t=nc+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function yc(e){return e*rc}function bc(e){return e*ic}function xc(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function Sc(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function Cc(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function wc(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:U(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function Tc(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}function Ec(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}var Dc={DEG2RAD:rc,RAD2DEG:ic,generateUUID:ac,clamp:oc,euclideanModulo:sc,mapLinear:cc,inverseLerp:lc,lerp:uc,damp:dc,pingpong:fc,smoothstep:pc,smootherstep:mc,randInt:hc,randFloat:gc,randFloatSpread:_c,seededRandom:vc,degToRad:yc,radToDeg:bc,isPowerOfTwo:xc,ceilPowerOfTwo:Sc,floorPowerOfTwo:Cc,setQuaternionFromProperEuler:wc,normalize:Ec,denormalize:Tc},G=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=oc(this.x,e.x,t.x),this.y=oc(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=oc(this.x,e,t),this.y=oc(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(oc(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(oc(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Oc=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:U(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(oc(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},K=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ac.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ac.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=oc(this.x,e.x,t.x),this.y=oc(this.y,e.y,t.y),this.z=oc(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=oc(this.x,e,t),this.y=oc(this.y,e,t),this.z=oc(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(oc(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return kc.copy(this).projectOnVector(e),this.sub(kc)}reflect(e){return this.sub(kc.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(oc(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},kc=new K,Ac=new Oc,jc=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return Zs(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(Mc.makeScale(e,t)),this}rotate(e){return Zs(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(Mc.makeRotation(-e)),this}translate(e,t){return Zs(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(Mc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Mc=new jc,Nc=new jc().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Pc=new jc().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Fc(){let e={enabled:!0,workingColorSpace:Is,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=Lc(e.r),e.g=Lc(e.g),e.b=Lc(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=Rc(e.r),e.g=Rc(e.g),e.b=Rc(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?Ls:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return Zs(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return Zs(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[Is]:{primaries:t,whitePoint:r,transfer:Ls,toXYZ:Nc,fromXYZ:Pc,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Fs},outputColorSpaceConfig:{drawingBufferColorSpace:Fs}},[Fs]:{primaries:t,whitePoint:r,transfer:Rs,toXYZ:Nc,fromXYZ:Pc,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Fs}}}),e}var Ic=Fc();function Lc(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function Rc(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var zc,Bc=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{zc===void 0&&(zc=Gs(`canvas`)),zc.width=e.width,zc.height=e.height;let t=zc.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=zc}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=Gs(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=Lc(i[e]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(Lc(t[e]/255)*255):t[e]=Lc(t[e]);return{data:t,width:e.width,height:e.height}}else return U(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},Vc=0,Hc=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,`id`,{value:Vc++}),this.uuid=ac(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(Uc(r[t].image)):e.push(Uc(r[t]))}else e=Uc(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function Uc(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?Bc.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(U(`Texture: Unable to serialize Texture.`),{})}var Wc=0,Gc=new K,Kc=class e extends ec{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,r=po,i=po,a=vo,o=bo,s=Io,c=xo,l=e.DEFAULT_ANISOTROPY,u=``){super(),this.isTexture=!0,Object.defineProperty(this,`id`,{value:Wc++}),this.uuid=ac(),this.name=``,this.source=new Hc(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=r,this.wrapT=i,this.magFilter=a,this.minFilter=o,this.anisotropy=l,this.format=s,this.internalFormat=null,this.type=c,this.offset=new G(0,0),this.repeat=new G(1,1),this.center=new G(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new jc,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Gc).x}get height(){return this.source.getSize(Gc).y}get depth(){return this.source.getSize(Gc).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){U(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){U(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case fo:e.x-=Math.floor(e.x);break;case po:e.x=e.x<0?0:1;break;case mo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case fo:e.y-=Math.floor(e.y);break;case po:e.y=e.y<0?0:1;break;case mo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Kc.DEFAULT_IMAGE=null,Kc.DEFAULT_MAPPING=300,Kc.DEFAULT_ANISOTROPY=1;var qc=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=oc(this.x,e.x,t.x),this.y=oc(this.y,e.y,t.y),this.z=oc(this.z,e.z,t.z),this.w=oc(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=oc(this.x,e,t),this.y=oc(this.y,e,t),this.z=oc(this.z,e,t),this.w=oc(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(oc(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Jc=class extends ec{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:vo,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new qc(0,0,e,t),this.scissorTest=!1,this.viewport=new qc(0,0,e,t),this.textures=[];let r=new Kc({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:vo,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new Hc(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},Yc=class extends Jc{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Xc=class extends Kc{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=ho,this.minFilter=ho,this.wrapR=po,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Zc=class extends Kc{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=ho,this.minFilter=ho,this.wrapR=po,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}},Qc=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/$c.setFromMatrixColumn(e,0).length(),i=1/$c.setFromMatrixColumn(e,1).length(),a=1/$c.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(tl,e,nl)}lookAt(e,t,n){let r=this.elements;return al.subVectors(e,t),al.lengthSq()===0&&(al.z=1),al.normalize(),rl.crossVectors(n,al),rl.lengthSq()===0&&(Math.abs(n.z)===1?al.x+=1e-4:al.z+=1e-4,al.normalize(),rl.crossVectors(n,al)),rl.normalize(),il.crossVectors(al,rl),r[0]=rl.x,r[4]=il.x,r[8]=al.x,r[1]=rl.y,r[5]=il.y,r[9]=al.y,r[2]=rl.z,r[6]=il.z,r[10]=al.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],ee=r[14],M=r[3],te=r[7],N=r[11],P=r[15];return i[0]=a*x+o*T+s*k+c*M,i[4]=a*S+o*E+s*A+c*te,i[8]=a*C+o*D+s*j+c*N,i[12]=a*w+o*O+s*ee+c*P,i[1]=l*x+u*T+d*k+f*M,i[5]=l*S+u*E+d*A+f*te,i[9]=l*C+u*D+d*j+f*N,i[13]=l*w+u*O+d*ee+f*P,i[2]=p*x+m*T+h*k+g*M,i[6]=p*S+m*E+h*A+g*te,i[10]=p*C+m*D+h*j+g*N,i[14]=p*w+m*O+h*ee+g*P,i[3]=_*x+v*T+y*k+b*M,i[7]=_*S+v*E+y*A+b*te,i[11]=_*C+v*D+y*j+b*N,i[15]=_*w+v*O+y*ee+b*P,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=$c.set(r[0],r[1],r[2]).length(),o=$c.set(r[4],r[5],r[6]).length(),s=$c.set(r[8],r[9],r[10]).length();i<0&&(a=-a),el.copy(this);let c=1/a,l=1/o,u=1/s;return el.elements[0]*=c,el.elements[1]*=c,el.elements[2]*=c,el.elements[4]*=l,el.elements[5]*=l,el.elements[6]*=l,el.elements[8]*=u,el.elements[9]*=u,el.elements[10]*=u,t.setFromRotationMatrix(el),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=Hs,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=Hs,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},$c=new K,el=new Qc,tl=new K(0,0,0),nl=new K(1,1,1),rl=new K,il=new K,al=new K,ol=new Qc,sl=new Oc,cl=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(oc(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-oc(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(oc(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-oc(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(oc(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-oc(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:U(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ol.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ol,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return sl.setFromEuler(this),this.setFromQuaternion(sl,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};cl.DEFAULT_ORDER=`XYZ`;var ll=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!=0}},ul=0,dl=new K,fl=new Oc,pl=new Qc,ml=new K,hl=new K,gl=new K,_l=new Oc,vl=new K(1,0,0),yl=new K(0,1,0),bl=new K(0,0,1),xl={type:`added`},Sl={type:`removed`},Cl={type:`childadded`,child:null},wl={type:`childremoved`,child:null},Tl=class e extends ec{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,`id`,{value:ul++}),this.uuid=ac(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new K,n=new cl,r=new Oc,i=new K(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Qc},normalMatrix:{value:new jc}}),this.matrix=new Qc,this.matrixWorld=new Qc,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ll,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return fl.setFromAxisAngle(e,t),this.quaternion.multiply(fl),this}rotateOnWorldAxis(e,t){return fl.setFromAxisAngle(e,t),this.quaternion.premultiply(fl),this}rotateX(e){return this.rotateOnAxis(vl,e)}rotateY(e){return this.rotateOnAxis(yl,e)}rotateZ(e){return this.rotateOnAxis(bl,e)}translateOnAxis(e,t){return dl.copy(e).applyQuaternion(this.quaternion),this.position.add(dl.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(vl,e)}translateY(e){return this.translateOnAxis(yl,e)}translateZ(e){return this.translateOnAxis(bl,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(pl.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ml.copy(e):ml.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),hl.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?pl.lookAt(hl,ml,this.up):pl.lookAt(ml,hl,this.up),this.quaternion.setFromRotationMatrix(pl),r&&(pl.extractRotation(r.matrixWorld),fl.setFromRotationMatrix(pl),this.quaternion.premultiply(fl.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(W(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(xl),Cl.child=e,this.dispatchEvent(Cl),Cl.child=null):W(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Sl),wl.child=e,this.dispatchEvent(wl),wl.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),pl.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),pl.multiply(e.parent.matrixWorld)),e.applyMatrix4(pl),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(xl),Cl.child=e,this.dispatchEvent(Cl),Cl.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(hl,e,gl),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(hl,_l,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material);if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:`dispose`})}};Tl.DEFAULT_UP=new K(0,1,0),Tl.DEFAULT_MATRIX_AUTO_UPDATE=!0,Tl.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var El=class extends Tl{constructor(){super(),this.isGroup=!0,this.type=`Group`}},Dl={type:`move`},Ol=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new El,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new El,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new K,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new K),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new El,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new K,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new K,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position),s=.02,l=.005;c.inputState.pinching&&o>s+l?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=s-l&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Dl)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new El;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},kl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Al={h:0,s:0,l:0},jl={h:0,s:0,l:0};function Ml(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var q=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Fs){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ic.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Ic.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ic.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Ic.workingColorSpace){if(e=sc(e,1),t=oc(t,0,1),n=oc(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=Ml(i,r,e+1/3),this.g=Ml(i,r,e),this.b=Ml(i,r,e-1/3)}return Ic.colorSpaceToWorking(this,r),this}setStyle(e,t=Fs){function n(t){t!==void 0&&parseFloat(t)<1&&U(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:U(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);U(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Fs){let n=kl[e.toLowerCase()];return n===void 0?U(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Lc(e.r),this.g=Lc(e.g),this.b=Lc(e.b),this}copyLinearToSRGB(e){return this.r=Rc(e.r),this.g=Rc(e.g),this.b=Rc(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Fs){return Ic.workingToColorSpace(Nl.copy(this),e),Math.round(oc(Nl.r*255,0,255))*65536+Math.round(oc(Nl.g*255,0,255))*256+Math.round(oc(Nl.b*255,0,255))}getHexString(e=Fs){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ic.workingColorSpace){Ic.workingToColorSpace(Nl.copy(this),t);let n=Nl.r,r=Nl.g,i=Nl.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4;break}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=Ic.workingColorSpace){return Ic.workingToColorSpace(Nl.copy(this),t),e.r=Nl.r,e.g=Nl.g,e.b=Nl.b,e}getStyle(e=Fs){Ic.workingToColorSpace(Nl.copy(this),e);let t=Nl.r,n=Nl.g,r=Nl.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(Al),this.setHSL(Al.h+e,Al.s+t,Al.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Al),e.getHSL(jl);let n=uc(Al.h,jl.h,t),r=uc(Al.s,jl.s,t),i=uc(Al.l,jl.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Nl=new q;q.NAMES=kl;var Pl=class e{constructor(e,t=25e-5){this.isFogExp2=!0,this.name=``,this.color=new q(e),this.density=t}clone(){return new e(this.color,this.density)}toJSON(){return{type:`FogExp2`,name:this.name,color:this.color.getHex(),density:this.density}}},Fl=class extends Tl{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new cl,this.environmentIntensity=1,this.environmentRotation=new cl,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Il=new K,Ll=new K,Rl=new K,zl=new K,Bl=new K,Vl=new K,Hl=new K,Ul=new K,Wl=new K,Gl=new K,Kl=new qc,ql=new qc,Jl=new qc,Yl=class e{constructor(e=new K,t=new K,n=new K){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Il.subVectors(e,t),r.cross(Il);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Il.subVectors(r,t),Ll.subVectors(n,t),Rl.subVectors(e,t);let a=Il.dot(Il),o=Il.dot(Ll),s=Il.dot(Rl),c=Ll.dot(Ll),l=Ll.dot(Rl),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,zl)===null?!1:zl.x>=0&&zl.y>=0&&zl.x+zl.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,zl)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,zl.x),s.addScaledVector(a,zl.y),s.addScaledVector(o,zl.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return Kl.setScalar(0),ql.setScalar(0),Jl.setScalar(0),Kl.fromBufferAttribute(e,t),ql.fromBufferAttribute(e,n),Jl.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Kl,i.x),a.addScaledVector(ql,i.y),a.addScaledVector(Jl,i.z),a}static isFrontFacing(e,t,n,r){return Il.subVectors(n,t),Ll.subVectors(e,t),Il.cross(Ll).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Il.subVectors(this.c,this.b),Ll.subVectors(this.a,this.b),Il.cross(Ll).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;Bl.subVectors(r,n),Vl.subVectors(i,n),Ul.subVectors(e,n);let s=Bl.dot(Ul),c=Vl.dot(Ul);if(s<=0&&c<=0)return t.copy(n);Wl.subVectors(e,r);let l=Bl.dot(Wl),u=Vl.dot(Wl);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(Bl,a);Gl.subVectors(e,i);let f=Bl.dot(Gl),p=Vl.dot(Gl);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(Vl,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return Hl.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(Hl,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(Bl,a).addScaledVector(Vl,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Xl=class{constructor(e=new K(1/0,1/0,1/0),t=new K(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Ql.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Ql.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Ql.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Ql):Ql.fromBufferAttribute(r,t),Ql.applyMatrix4(e.matrixWorld),this.expandByPoint(Ql);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),$l.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),$l.copy(e.boundingBox)),$l.applyMatrix4(e.matrixWorld),this.union($l)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Ql),Ql.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ou),su.subVectors(this.max,ou),eu.subVectors(e.a,ou),tu.subVectors(e.b,ou),nu.subVectors(e.c,ou),ru.subVectors(tu,eu),iu.subVectors(nu,tu),au.subVectors(eu,nu);let t=[0,-ru.z,ru.y,0,-iu.z,iu.y,0,-au.z,au.y,ru.z,0,-ru.x,iu.z,0,-iu.x,au.z,0,-au.x,-ru.y,ru.x,0,-iu.y,iu.x,0,-au.y,au.x,0];return!uu(t,eu,tu,nu,su)||(t=[1,0,0,0,1,0,0,0,1],!uu(t,eu,tu,nu,su))?!1:(cu.crossVectors(ru,iu),t=[cu.x,cu.y,cu.z],uu(t,eu,tu,nu,su))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Ql).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Ql).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Zl[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Zl[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Zl[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Zl[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Zl[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Zl[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Zl[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Zl[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Zl),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Zl=[new K,new K,new K,new K,new K,new K,new K,new K],Ql=new K,$l=new Xl,eu=new K,tu=new K,nu=new K,ru=new K,iu=new K,au=new K,ou=new K,su=new K,cu=new K,lu=new K;function uu(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){lu.fromArray(e,a);let o=i.x*Math.abs(lu.x)+i.y*Math.abs(lu.y)+i.z*Math.abs(lu.z),s=t.dot(lu),c=n.dot(lu),l=r.dot(lu);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var du=new K,fu=new G,pu=0,mu=class extends ec{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,`id`,{value:pu++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=Bs,this.updateRanges=[],this.gpuType=Do,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)fu.fromBufferAttribute(this,t),fu.applyMatrix3(e),this.setXY(t,fu.x,fu.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)du.fromBufferAttribute(this,t),du.applyMatrix3(e),this.setXYZ(t,du.x,du.y,du.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)du.fromBufferAttribute(this,t),du.applyMatrix4(e),this.setXYZ(t,du.x,du.y,du.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)du.fromBufferAttribute(this,t),du.applyNormalMatrix(e),this.setXYZ(t,du.x,du.y,du.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)du.fromBufferAttribute(this,t),du.transformDirection(e),this.setXYZ(t,du.x,du.y,du.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Tc(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Ec(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Tc(t,this.array)),t}setX(e,t){return this.normalized&&(t=Ec(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Tc(t,this.array)),t}setY(e,t){return this.normalized&&(t=Ec(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Tc(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Ec(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Tc(t,this.array)),t}setW(e,t){return this.normalized&&(t=Ec(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Ec(t,this.array),n=Ec(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=Ec(t,this.array),n=Ec(n,this.array),r=Ec(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=Ec(t,this.array),n=Ec(n,this.array),r=Ec(r,this.array),i=Ec(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:`dispose`})}},hu=class extends mu{constructor(e,t,n){super(new Uint16Array(e),t,n)}},gu=class extends mu{constructor(e,t,n){super(new Uint32Array(e),t,n)}},J=class extends mu{constructor(e,t,n){super(new Float32Array(e),t,n)}},_u=new Xl,vu=new K,yu=new K,bu=class{constructor(e=new K,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?_u.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;vu.subVectors(e,this.center);let t=vu.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(vu,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(yu.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(vu.copy(e.center).add(yu)),this.expandByPoint(vu.copy(e.center).sub(yu))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},xu=0,Su=new Qc,Cu=new Tl,wu=new K,Tu=new Xl,Eu=new Xl,Du=new K,Ou=class e extends ec{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,`id`,{value:xu++}),this.uuid=ac(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Us(e)?gu:hu)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new jc().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Su.makeRotationFromQuaternion(e),this.applyMatrix4(Su),this}rotateX(e){return Su.makeRotationX(e),this.applyMatrix4(Su),this}rotateY(e){return Su.makeRotationY(e),this.applyMatrix4(Su),this}rotateZ(e){return Su.makeRotationZ(e),this.applyMatrix4(Su),this}translate(e,t,n){return Su.makeTranslation(e,t,n),this.applyMatrix4(Su),this}scale(e,t,n){return Su.makeScale(e,t,n),this.applyMatrix4(Su),this}lookAt(e){return Cu.lookAt(e),Cu.updateMatrix(),this.applyMatrix4(Cu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(wu).negate(),this.translate(wu.x,wu.y,wu.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new J(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&U(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Xl);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){W(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new K(-1/0,-1/0,-1/0),new K(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Tu.setFromBufferAttribute(n),this.morphTargetsRelative?(Du.addVectors(this.boundingBox.min,Tu.min),this.boundingBox.expandByPoint(Du),Du.addVectors(this.boundingBox.max,Tu.max),this.boundingBox.expandByPoint(Du)):(this.boundingBox.expandByPoint(Tu.min),this.boundingBox.expandByPoint(Tu.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&W(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new bu);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){W(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new K,1/0);return}if(e){let n=this.boundingSphere.center;if(Tu.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Eu.setFromBufferAttribute(n),this.morphTargetsRelative?(Du.addVectors(Tu.min,Eu.min),Tu.expandByPoint(Du),Du.addVectors(Tu.max,Eu.max),Tu.expandByPoint(Du)):(Tu.expandByPoint(Eu.min),Tu.expandByPoint(Eu.max))}Tu.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)Du.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(Du));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)Du.fromBufferAttribute(a,t),o&&(wu.fromBufferAttribute(e,t),Du.add(wu)),r=Math.max(r,n.distanceToSquared(Du))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&W(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){W(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new mu(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new K,s[e]=new K;let c=new K,l=new K,u=new K,d=new G,f=new G,p=new G,m=new K,h=new K;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new K,y=new K,b=new K,x=new K;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new mu(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new K,i=new K,a=new K,o=new K,s=new K,c=new K,l=new K,u=new K;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Du.fromBufferAttribute(e,t),Du.normalize(),e.setXYZ(t,Du.x,Du.y,Du.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new mu(a,r,i)}if(this.index===null)return U(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},ku=new K,Au=new K,ju=new jc,Mu=class{constructor(e=new K(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=ku.subVectors(n,t).cross(Au.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(ku),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||ju.getNormalMatrix(e),r=this.coplanarPoint(ku).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Nu=0,Pu=class extends ec{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,`id`,{value:Nu++}),this.uuid=ac(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new q(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=zs,this.stencilZFail=zs,this.stencilZPass=zs,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){U(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){U(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(e=>e.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new q().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(e=>new Mu().fromJSON(e))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors==`number`?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new G().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new G().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},Fu=new K,Iu=new K,Lu=class extends Tl{constructor(){super(),this.isLOD=!0,this._currentLevel=0,this.type=`LOD`,Object.defineProperties(this,{levels:{enumerable:!0,value:[]}}),this.autoUpdate=!0}copy(e){super.copy(e,!1);let t=e.levels;for(let e=0,n=t.length;e<n;e++){let n=t[e];this.addLevel(n.object.clone(),n.distance,n.hysteresis)}return this.autoUpdate=e.autoUpdate,this}addLevel(e,t=0,n=0){t=Math.abs(t);let r=this.levels,i;for(i=0;i<r.length&&!(t<r[i].distance);i++);return r.splice(i,0,{distance:t,hysteresis:n,object:e}),this.add(e),this}removeLevel(e){let t=this.levels;for(let n=0;n<t.length;n++)if(t[n].distance===e){let e=t.splice(n,1);return this.remove(e[0].object),!0}return!1}getCurrentLevel(){return this._currentLevel}getObjectForDistance(e){let t=this.levels;if(t.length>0){let n,r;for(n=1,r=t.length;n<r;n++){let r=t[n].distance;if(t[n].object.visible&&(r-=r*t[n].hysteresis),e<r)break}return t[n-1].object}return null}raycast(e,t){if(this.levels.length>0){Fu.setFromMatrixPosition(this.matrixWorld);let n=e.ray.origin.distanceTo(Fu);this.getObjectForDistance(n).raycast(e,t)}}update(e){let t=this.levels;if(t.length>1){Fu.setFromMatrixPosition(e.matrixWorld),Iu.setFromMatrixPosition(this.matrixWorld);let n=Fu.distanceTo(Iu)/e.zoom;t[0].object.visible=!0;let r,i;for(r=1,i=t.length;r<i;r++){let e=t[r].distance;if(t[r].object.visible&&(e-=e*t[r].hysteresis),n>=e)t[r-1].object.visible=!1,t[r].object.visible=!0;else break}for(this._currentLevel=r-1;r<i;r++)t[r].object.visible=!1}}toJSON(e){let t=super.toJSON(e);t.object.autoUpdate=this.autoUpdate,t.object.levels=[];let n=this.levels;for(let e=0,r=n.length;e<r;e++){let r=n[e];t.object.levels.push({object:r.object.uuid,distance:r.distance,hysteresis:r.hysteresis})}return t}},Ru=new K,zu=new K,Bu=new K,Vu=new K,Hu=class{constructor(e=new K,t=new K(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ru)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Ru.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ru.copy(this.origin).addScaledVector(this.direction,t),Ru.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){zu.copy(e).add(t).multiplyScalar(.5),Bu.copy(t).sub(e).normalize(),Vu.copy(this.origin).sub(zu);let i=e.distanceTo(t)*.5,a=-this.direction.dot(Bu),o=Vu.dot(this.direction),s=-Vu.dot(Bu),c=Vu.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0)if(u=a*s-o,d=a*o-s,p=i*l,u>=0)if(d>=-p)if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c);else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(zu).addScaledVector(Bu,d),f}intersectSphere(e,t){if(e.radius<0)return null;Ru.subVectors(e.center,this.origin);let n=Ru.dot(this.direction),r=Ru.dot(Ru)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,Ru)!==null}intersectTriangle(e,t,n,r,i){let a=this.origin,o=this.direction,s=o.x,c=o.y,l=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,m=t.y-a.y,h=t.z-a.z,g=n.x-a.x,_=n.y-a.y,v=n.z-a.z,y=Math.abs(s),b=Math.abs(c),x=Math.abs(l),S,C,w,T,E,D,O,k,A,j,ee,M;if(y>=b&&y>=x?(w=s,D=u,A=p,M=g,s>=0?(S=c,C=l,T=d,E=f,O=m,k=h,j=_,ee=v):(S=l,C=c,T=f,E=d,O=h,k=m,j=v,ee=_)):b>=x?(w=c,D=d,A=m,M=_,c>=0?(S=l,C=s,T=f,E=u,O=h,k=p,j=v,ee=g):(S=s,C=l,T=u,E=f,O=p,k=h,j=g,ee=v)):(w=l,D=f,A=h,M=v,l>=0?(S=s,C=c,T=u,E=d,O=p,k=m,j=g,ee=_):(S=c,C=s,T=d,E=u,O=m,k=p,j=_,ee=g)),w===0)return null;let te=S/w,N=C/w,P=1/w,ne=T-te*D,re=E-N*D,ie=O-te*A,ae=k-N*A,F=j-te*M,oe=ee-N*M,se=F*ae-oe*ie,I=ne*oe-re*F,L=ie*re-ae*ne;if(r){if(se<0||I<0||L<0)return null}else if((se<0||I<0||L<0)&&(se>0||I>0||L>0))return null;let ce=se+I+L;if(ce===0)return null;let le=P*(se*D+I*A+L*M);return(ce>0?le<0:le>0)?null:this.at(le/ce,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Uu=class extends Pu{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new q(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cl,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Wu=new Qc,Gu=new Hu,Ku=new bu,qu=new K,Ju=new K,Yu=new K,Xu=new K,Zu=new K,Qu=new K,$u=new K,ed=new K,Y=class extends Tl{constructor(e=new Ou,t=new Uu){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Qu.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(Zu.fromBufferAttribute(s,e),a?Qu.addScaledVector(Zu,r):Qu.addScaledVector(Zu.sub(t),r))}t.add(Qu)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ku.copy(n.boundingSphere),Ku.applyMatrix4(i),Gu.copy(e.ray).recast(e.near),!(Ku.containsPoint(Gu.origin)===!1&&(Gu.intersectSphere(Ku,qu)===null||Gu.origin.distanceToSquared(qu)>(e.far-e.near)**2))&&(Wu.copy(i).invert(),Gu.copy(e.ray).applyMatrix4(Wu),!(n.boundingBox!==null&&Gu.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Gu)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null)if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=nd(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=nd(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}else if(s!==void 0)if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=nd(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=nd(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}};function td(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;ed.copy(s),ed.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(ed);return l<n.near||l>n.far?null:{distance:l,point:ed.clone(),object:e}}function nd(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Ju),e.getVertexPosition(c,Yu),e.getVertexPosition(l,Xu);let u=td(e,t,n,r,Ju,Yu,Xu,$u);if(u){let e=new K;Yl.getBarycoord($u,Ju,Yu,Xu,e),i&&(u.uv=Yl.getInterpolatedAttribute(i,s,c,l,e,new G)),a&&(u.uv1=Yl.getInterpolatedAttribute(a,s,c,l,e,new G)),o&&(u.normal=Yl.getInterpolatedAttribute(o,s,c,l,e,new K),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new K,materialIndex:0};Yl.getNormal(Ju,Yu,Xu,t.normal),u.face=t,u.barycoord=e}return u}var rd=class extends Kc{constructor(e=null,t=1,n=1,r,i,a,o,s,c=ho,l=ho,u,d){super(null,a,o,s,c,l,r,i,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},id=class extends mu{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},ad=new Qc,od=new Qc,sd=[],cd=new Xl,ld=new Qc,ud=new Y,dd=new bu,fd=class extends Y{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new id(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,ld)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Xl),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ad),cd.copy(e.boundingBox).applyMatrix4(ad),this.boundingBox.union(cd)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new bu),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ad),dd.copy(e.boundingSphere).applyMatrix4(ad),this.boundingSphere.union(dd)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(ud.geometry=this.geometry,ud.material=this.material,ud.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),dd.copy(this.boundingSphere),dd.applyMatrix4(n),e.ray.intersectsSphere(dd)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,ad),od.multiplyMatrices(n,ad),ud.matrixWorld=od,ud.raycast(e,sd);for(let e=0,n=sd.length;e<n;e++){let n=sd[e];n.instanceId=i,n.object=this,t.push(n)}sd.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new id(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new rd(new Float32Array(r*this.count),r,this.count,zo,Do));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},pd=new bu,md=new G(.5,.5),hd=new K,gd=class{constructor(e=new Mu,t=new Mu,n=new Mu,r=new Mu,i=new Mu,a=new Mu){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Hs,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),pd.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),pd.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(pd)}intersectsSprite(e){return pd.center.set(0,0,0),pd.radius=.7071067811865476+md.distanceTo(e.center),pd.applyMatrix4(e.matrixWorld),this.intersectsSphere(pd)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(hd.x=r.normal.x>0?e.max.x:e.min.x,hd.y=r.normal.y>0?e.max.y:e.min.y,hd.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(hd)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},_d=class extends Pu{constructor(e){super(),this.isLineBasicMaterial=!0,this.type=`LineBasicMaterial`,this.color=new q(16777215),this.map=null,this.linewidth=1,this.linecap=`round`,this.linejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},vd=new K,yd=new K,bd=new Qc,xd=new Hu,Sd=new bu,Cd=new K,wd=new K,Td=class extends Tl{constructor(e=new Ou,t=new _d){super(),this.isLine=!0,this.type=`Line`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let e=1,r=t.count;e<r;e++)vd.fromBufferAttribute(t,e-1),yd.fromBufferAttribute(t,e),n[e]=n[e-1],n[e]+=vd.distanceTo(yd);e.setAttribute(`lineDistance`,new J(n,1))}else U(`Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Sd.copy(n.boundingSphere),Sd.applyMatrix4(r),Sd.radius+=i,e.ray.intersectsSphere(Sd)===!1)return;bd.copy(r).invert(),xd.copy(e.ray).applyMatrix4(bd);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=this.isLineSegments?2:1,l=n.index,u=n.attributes.position;if(l!==null){let n=Math.max(0,a.start),r=Math.min(l.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=l.getX(i),r=l.getX(i+1),a=Ed(this,e,xd,s,n,r,i);a&&t.push(a)}if(this.isLineLoop){let i=l.getX(r-1),a=l.getX(n),o=Ed(this,e,xd,s,i,a,r-1);o&&t.push(o)}}else{let n=Math.max(0,a.start),r=Math.min(u.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=Ed(this,e,xd,s,i,i+1,i);n&&t.push(n)}if(this.isLineLoop){let i=Ed(this,e,xd,s,r-1,n,r-1);i&&t.push(i)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function Ed(e,t,n,r,i,a,o){let s=e.geometry.attributes.position;if(vd.fromBufferAttribute(s,i),yd.fromBufferAttribute(s,a),n.distanceSqToSegment(vd,yd,Cd,wd)>r)return;Cd.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Cd);if(!(c<t.near||c>t.far))return{distance:c,point:wd.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}var Dd=new K,Od=new K,kd=class extends Td{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type=`LineSegments`}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let e=0,r=t.count;e<r;e+=2)Dd.fromBufferAttribute(t,e),Od.fromBufferAttribute(t,e+1),n[e]=e===0?0:n[e-1],n[e+1]=n[e]+Dd.distanceTo(Od);e.setAttribute(`lineDistance`,new J(n,1))}else U(`LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}},Ad=class extends Pu{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new q(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},jd=new Qc,Md=new Hu,Nd=new bu,Pd=new K,Fd=class extends Tl{constructor(e=new Ou,t=new Ad){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Nd.copy(n.boundingSphere),Nd.applyMatrix4(r),Nd.radius+=i,e.ray.intersectsSphere(Nd)===!1)return;jd.copy(r).invert(),Md.copy(e.ray).applyMatrix4(jd);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);Pd.fromBufferAttribute(l,n),Id(Pd,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)Pd.fromBufferAttribute(l,a),Id(Pd,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function Id(e,t,n,r,i,a,o){let s=Md.distanceSqToPoint(e);if(s<n){let n=new K;Md.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var Ld=class extends Kc{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Rd=class extends Kc{constructor(e,t,n,r,i,a,o,s,c){super(e,t,n,r,i,a,o,s,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},zd=class extends Kc{constructor(e,t,n=Eo,r,i,a,o=ho,s=ho,c,l=Lo,u=1){if(l!==1026&&l!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:u},r,i,a,o,s,l,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Hc(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},Bd=class extends zd{constructor(e,t=Eo,n=301,r,i,a=ho,o=ho,s,c=Lo){let l={width:e,height:e,depth:1},u=[l,l,l,l,l,l];super(e,e,t,n,r,i,a,o,s,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Vd=class extends Kc{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},X=class e extends Ou{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new J(c,3)),this.setAttribute(`normal`,new J(l,3)),this.setAttribute(`uv`,new J(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new K;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},Z=class e extends Ou{constructor(e=1,t=1,n=1,r=32,i=1,a=!1,o=0,s=Math.PI*2){super(),this.type=`CylinderGeometry`,this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:i,openEnded:a,thetaStart:o,thetaLength:s};let c=this;r=Math.floor(r),i=Math.floor(i);let l=[],u=[],d=[],f=[],p=0,m=[],h=n/2,g=0;_(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(l),this.setAttribute(`position`,new J(u,3)),this.setAttribute(`normal`,new J(d,3)),this.setAttribute(`uv`,new J(f,2));function _(){let a=new K,_=new K,v=0,y=(t-e)/n;for(let c=0;c<=i;c++){let l=[],g=c/i,v=g*(t-e)+e;for(let e=0;e<=r;e++){let t=e/r,i=t*s+o,c=Math.sin(i),m=Math.cos(i);_.x=v*c,_.y=-g*n+h,_.z=v*m,u.push(_.x,_.y,_.z),a.set(c,y,m).normalize(),d.push(a.x,a.y,a.z),f.push(t,1-g),l.push(p++)}m.push(l)}for(let n=0;n<r;n++)for(let r=0;r<i;r++){let a=m[r][n],o=m[r+1][n],s=m[r+1][n+1],c=m[r][n+1];(e>0||r!==0)&&(l.push(a,o,c),v+=3),(t>0||r!==i-1)&&(l.push(o,s,c),v+=3)}c.addGroup(g,v,0),g+=v}function v(n){let i=p,a=new G,m=new K,_=0,v=n===!0?e:t,y=n===!0?1:-1;for(let e=1;e<=r;e++)u.push(0,h*y,0),d.push(0,y,0),f.push(.5,.5),p++;let b=p;for(let e=0;e<=r;e++){let t=e/r*s+o,n=Math.cos(t),i=Math.sin(t);m.x=v*i,m.y=h*y,m.z=v*n,u.push(m.x,m.y,m.z),d.push(0,y,0),a.x=n*.5+.5,a.y=i*.5*y+.5,f.push(a.x,a.y),p++}for(let e=0;e<r;e++){let t=i+e,r=b+e;n===!0?l.push(r,r+1,t):l.push(r+1,r,t),_+=3}c.addGroup(g,_,n===!0?1:2),g+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Hd=class e extends Z{constructor(e=1,t=1,n=32,r=1,i=!1,a=0,o=Math.PI*2){super(0,e,t,n,r,i,a,o),this.type=`ConeGeometry`,this.parameters={radius:e,height:t,radialSegments:n,heightSegments:r,openEnded:i,thetaStart:a,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ud=class e extends Ou{constructor(e=[],t=[],n=1,r=0){super(),this.type=`PolyhedronGeometry`,this.parameters={vertices:e,indices:t,radius:n,detail:r};let i=[],a=[];o(r),c(n),l(),this.setAttribute(`position`,new J(i,3)),this.setAttribute(`normal`,new J(i.slice(),3)),this.setAttribute(`uv`,new J(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(e){let n=new K,r=new K,i=new K;for(let a=0;a<t.length;a+=3)f(t[a+0],n),f(t[a+1],r),f(t[a+2],i),s(n,r,i,e)}function s(e,t,n,r){let i=r+1,a=[];for(let r=0;r<=i;r++){a[r]=[];let o=e.clone().lerp(n,r/i),s=t.clone().lerp(n,r/i),c=i-r;for(let e=0;e<=c;e++)e===0&&r===i?a[r][e]=o:a[r][e]=o.clone().lerp(s,e/c)}for(let e=0;e<i;e++)for(let t=0;t<2*(i-e)-1;t++){let n=Math.floor(t/2);t%2==0?(d(a[e][n+1]),d(a[e+1][n]),d(a[e][n])):(d(a[e][n+1]),d(a[e+1][n+1]),d(a[e+1][n]))}}function c(e){let t=new K;for(let n=0;n<i.length;n+=3)t.x=i[n+0],t.y=i[n+1],t.z=i[n+2],t.normalize().multiplyScalar(e),i[n+0]=t.x,i[n+1]=t.y,i[n+2]=t.z}function l(){let e=new K;for(let t=0;t<i.length;t+=3){e.x=i[t+0],e.y=i[t+1],e.z=i[t+2];let n=h(e)/2/Math.PI+.5,r=g(e)/Math.PI+.5;a.push(n,1-r)}p(),u()}function u(){for(let e=0;e<a.length;e+=6){let t=a[e+0],n=a[e+2],r=a[e+4];Math.max(t,n,r)>.9&&Math.min(t,n,r)<.1&&(t<.2&&(a[e+0]+=1),n<.2&&(a[e+2]+=1),r<.2&&(a[e+4]+=1))}}function d(e){i.push(e.x,e.y,e.z)}function f(t,n){let r=t*3;n.x=e[r+0],n.y=e[r+1],n.z=e[r+2]}function p(){let e=new K,t=new K,n=new K,r=new K,o=new G,s=new G,c=new G;for(let l=0,u=0;l<i.length;l+=9,u+=6){e.set(i[l+0],i[l+1],i[l+2]),t.set(i[l+3],i[l+4],i[l+5]),n.set(i[l+6],i[l+7],i[l+8]),o.set(a[u+0],a[u+1]),s.set(a[u+2],a[u+3]),c.set(a[u+4],a[u+5]),r.copy(e).add(t).add(n).divideScalar(3);let d=h(r);m(o,u+0,e,d),m(s,u+2,t,d),m(c,u+4,n,d)}}function m(e,t,n,r){r<0&&e.x===1&&(a[t]=e.x-1),n.x===0&&n.z===0&&(a[t]=r/2/Math.PI+.5)}function h(e){return Math.atan2(e.z,-e.x)}function g(e){return Math.atan2(-e.y,Math.sqrt(e.x*e.x+e.z*e.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.vertices,t.indices,t.radius,t.detail)}},Wd=class e extends Ud{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=1/n,i=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-r,-n,0,-r,n,0,r,-n,0,r,n,-r,-n,0,-r,n,0,r,-n,0,r,n,0,-n,0,-r,n,0,-r,-n,0,r,n,0,r];super(i,[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9],e,t),this.type=`DodecahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},Gd=class{constructor(){this.type=`Curve`,this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){U(`Curve: .getPoint() not implemented.`)}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),i=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),i+=n.distanceTo(r),t.push(i),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,i=n.length,a;a=t||e*n[i-1];let o=0,s=i-1,c;for(;o<=s;)if(r=Math.floor(o+(s-o)/2),c=n[r]-a,c<0)o=r+1;else if(c>0)s=r-1;else{s=r;break}if(r=s,n[r]===a)return r/(i-1);let l=n[r],u=n[r+1]-l,d=(a-l)/u;return(r+d)/(i-1)}getTangent(e,t){let n=1e-4,r=e-n,i=e+n;r<0&&(r=0),i>1&&(i=1);let a=this.getPoint(r),o=this.getPoint(i),s=t||(a.isVector2?new G:new K);return s.copy(o).sub(a).normalize(),s}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new K,r=[],i=[],a=[],o=new K,s=new Qc;for(let t=0;t<=e;t++){let n=t/e;r[t]=this.getTangentAt(n,new K)}i[0]=new K,a[0]=new K;let c=Number.MAX_VALUE,l=Math.abs(r[0].x),u=Math.abs(r[0].y),d=Math.abs(r[0].z);l<=c&&(c=l,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),i[0].crossVectors(r[0],o),a[0].crossVectors(r[0],i[0]);for(let t=1;t<=e;t++){if(i[t]=i[t-1].clone(),a[t]=a[t-1].clone(),o.crossVectors(r[t-1],r[t]),o.length()>2**-52){o.normalize();let e=Math.acos(oc(r[t-1].dot(r[t]),-1,1));i[t].applyMatrix4(s.makeRotationAxis(o,e))}a[t].crossVectors(r[t],i[t])}if(t===!0){let t=Math.acos(oc(i[0].dot(i[e]),-1,1));t/=e,r[0].dot(o.crossVectors(i[0],i[e]))>0&&(t=-t);for(let n=1;n<=e;n++)i[n].applyMatrix4(s.makeRotationAxis(r[n],t*n)),a[n].crossVectors(r[n],i[n])}return{tangents:r,normals:i,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:`Curve`,generator:`Curve.toJSON`}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Kd=class extends Gd{constructor(e=0,t=0,n=1,r=1,i=0,a=Math.PI*2,o=!1,s=0){super(),this.isEllipseCurve=!0,this.type=`EllipseCurve`,this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=i,this.aEndAngle=a,this.aClockwise=o,this.aRotation=s}getPoint(e,t=new G){let n=t,r=Math.PI*2,i=this.aEndAngle-this.aStartAngle,a=Math.abs(i)<2**-52;for(;i<0;)i+=r;for(;i>r;)i-=r;i<2**-52&&(i=a?0:r),this.aClockwise===!0&&!a&&(i===r?i=-r:i-=r);let o=this.aStartAngle+e*i,s=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let e=Math.cos(this.aRotation),t=Math.sin(this.aRotation),n=s-this.aX,r=c-this.aY;s=n*e-r*t+this.aX,c=n*t+r*e+this.aY}return n.set(s,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},qd=class extends Kd{constructor(e,t,n,r,i,a){super(e,t,n,n,r,i,a),this.isArcCurve=!0,this.type=`ArcCurve`}};function Jd(){let e=0,t=0,n=0,r=0;function i(i,a,o,s){e=i,t=o,n=-3*i+3*a-2*o-s,r=2*i-2*a+o+s}return{initCatmullRom:function(e,t,n,r,a){i(t,n,a*(n-e),a*(r-t))},initNonuniformCatmullRom:function(e,t,n,r,a,o,s){let c=(t-e)/a-(n-e)/(a+o)+(n-t)/o,l=(n-t)/o-(r-t)/(o+s)+(r-n)/s;c*=o,l*=o,i(t,n,c,l)},calc:function(i){let a=i*i,o=a*i;return e+t*i+n*a+r*o}}}var Yd=new K,Xd=new K,Zd=new Jd,Qd=new Jd,$d=new Jd,ef=class extends Gd{constructor(e=[],t=!1,n=`centripetal`,r=.5){super(),this.isCatmullRomCurve3=!0,this.type=`CatmullRomCurve3`,this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new K){let n=t,r=this.points,i=r.length,a=(i-+!this.closed)*e,o=Math.floor(a),s=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/i)+1)*i:s===0&&o===i-1&&(o=i-2,s=1);let c,l;this.closed||o>0?c=r[(o-1)%i]:(Xd.subVectors(r[0],r[1]).add(r[0]),c=Xd);let u=r[o%i],d=r[(o+1)%i];if(this.closed||o+2<i?l=r[(o+2)%i]:(Yd.subVectors(r[i-1],r[i-2]).add(r[i-1]),l=Yd),this.curveType===`centripetal`||this.curveType===`chordal`){let e=this.curveType===`chordal`?.5:.25,t=c.distanceToSquared(u)**+e,n=u.distanceToSquared(d)**+e,r=d.distanceToSquared(l)**+e;n<1e-4&&(n=1),t<1e-4&&(t=n),r<1e-4&&(r=n),Zd.initNonuniformCatmullRom(c.x,u.x,d.x,l.x,t,n,r),Qd.initNonuniformCatmullRom(c.y,u.y,d.y,l.y,t,n,r),$d.initNonuniformCatmullRom(c.z,u.z,d.z,l.z,t,n,r)}else this.curveType===`catmullrom`&&(Zd.initCatmullRom(c.x,u.x,d.x,l.x,this.tension),Qd.initCatmullRom(c.y,u.y,d.y,l.y,this.tension),$d.initCatmullRom(c.z,u.z,d.z,l.z,this.tension));return n.set(Zd.calc(s),Qd.calc(s),$d.calc(s)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new K().fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function tf(e,t,n,r,i){let a=(r-t)*.5,o=(i-n)*.5,s=e*e,c=e*s;return(2*n-2*r+a+o)*c+(-3*n+3*r-2*a-o)*s+a*e+n}function nf(e,t){let n=1-e;return n*n*t}function rf(e,t){return 2*(1-e)*e*t}function af(e,t){return e*e*t}function of(e,t,n,r){return nf(e,t)+rf(e,n)+af(e,r)}function sf(e,t){let n=1-e;return n*n*n*t}function cf(e,t){let n=1-e;return 3*n*n*e*t}function lf(e,t){return 3*(1-e)*e*e*t}function uf(e,t){return e*e*e*t}function df(e,t,n,r,i){return sf(e,t)+cf(e,n)+lf(e,r)+uf(e,i)}var ff=class extends Gd{constructor(e=new G,t=new G,n=new G,r=new G){super(),this.isCubicBezierCurve=!0,this.type=`CubicBezierCurve`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new G){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(df(e,r.x,i.x,a.x,o.x),df(e,r.y,i.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},pf=class extends Gd{constructor(e=new K,t=new K,n=new K,r=new K){super(),this.isCubicBezierCurve3=!0,this.type=`CubicBezierCurve3`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new K){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(df(e,r.x,i.x,a.x,o.x),df(e,r.y,i.y,a.y,o.y),df(e,r.z,i.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},mf=class extends Gd{constructor(e=new G,t=new G){super(),this.isLineCurve=!0,this.type=`LineCurve`,this.v1=e,this.v2=t}getPoint(e,t=new G){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new G){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},hf=class extends Gd{constructor(e=new K,t=new K){super(),this.isLineCurve3=!0,this.type=`LineCurve3`,this.v1=e,this.v2=t}getPoint(e,t=new K){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new K){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},gf=class extends Gd{constructor(e=new G,t=new G,n=new G){super(),this.isQuadraticBezierCurve=!0,this.type=`QuadraticBezierCurve`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new G){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set(of(e,r.x,i.x,a.x),of(e,r.y,i.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},_f=class extends Gd{constructor(e=new K,t=new K,n=new K){super(),this.isQuadraticBezierCurve3=!0,this.type=`QuadraticBezierCurve3`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new K){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set(of(e,r.x,i.x,a.x),of(e,r.y,i.y,a.y),of(e,r.z,i.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},vf=class extends Gd{constructor(e=[]){super(),this.isSplineCurve=!0,this.type=`SplineCurve`,this.points=e}getPoint(e,t=new G){let n=t,r=this.points,i=(r.length-1)*e,a=Math.floor(i),o=i-a,s=r[a===0?a:a-1],c=r[a],l=r[a>r.length-2?r.length-1:a+1],u=r[a>r.length-3?r.length-1:a+2];return n.set(tf(o,s.x,c.x,l.x,u.x),tf(o,s.y,c.y,l.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new G().fromArray(n))}return this}},yf=Object.freeze({__proto__:null,ArcCurve:qd,CatmullRomCurve3:ef,CubicBezierCurve:ff,CubicBezierCurve3:pf,EllipseCurve:Kd,LineCurve:mf,LineCurve3:hf,QuadraticBezierCurve:gf,QuadraticBezierCurve3:_f,SplineCurve:vf}),bf=class extends Gd{constructor(){super(),this.type=`CurvePath`,this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?`LineCurve`:`LineCurve3`;this.curves.push(new yf[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),r=this.getCurveLengths(),i=0;for(;i<r.length;){if(r[i]>=n){let e=r[i]-n,a=this.curves[i],o=a.getLength(),s=o===0?0:1-e/o;return a.getPointAt(s,t)}i++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,r=this.curves.length;n<r;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let r=0,i=this.curves;r<i.length;r++){let a=i[r],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,s=a.getPoints(o);for(let e=0;e<s.length;e++){let r=s[e];n&&n.equals(r)||(t.push(r),n=r)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let n=e.curves[t];this.curves.push(n.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let n=this.curves[t];e.curves.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let n=e.curves[t];this.curves.push(new yf[n.type]().fromJSON(n))}return this}},xf=class extends bf{constructor(e){super(),this.type=`Path`,this.currentPoint=new G,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new mf(this.currentPoint.clone(),new G(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,r){let i=new gf(this.currentPoint.clone(),new G(e,t),new G(n,r));return this.curves.push(i),this.currentPoint.set(n,r),this}bezierCurveTo(e,t,n,r,i,a){let o=new ff(this.currentPoint.clone(),new G(e,t),new G(n,r),new G(i,a));return this.curves.push(o),this.currentPoint.set(i,a),this}splineThru(e){let t=new vf([this.currentPoint.clone()].concat(e));return this.curves.push(t),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,r,i,a){let o=this.currentPoint.x,s=this.currentPoint.y;return this.absarc(e+o,t+s,n,r,i,a),this}absarc(e,t,n,r,i,a){return this.absellipse(e,t,n,n,r,i,a),this}ellipse(e,t,n,r,i,a,o,s){let c=this.currentPoint.x,l=this.currentPoint.y;return this.absellipse(e+c,t+l,n,r,i,a,o,s),this}absellipse(e,t,n,r,i,a,o,s){let c=new Kd(e,t,n,r,i,a,o,s);if(this.curves.length>0){let e=c.getPoint(0);e.equals(this.currentPoint)||this.lineTo(e.x,e.y)}this.curves.push(c);let l=c.getPoint(1);return this.currentPoint.copy(l),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},Sf=class extends xf{constructor(e){super(e),this.uuid=ac(),this.type=`Shape`,this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,r=this.holes.length;n<r;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let n=e.holes[t];this.holes.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let n=this.holes[t];e.holes.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let n=e.holes[t];this.holes.push(new xf().fromJSON(n))}return this}};function Cf(e,t,n=2){let r=t&&t.length,i=r?t[0]*n:e.length,a=wf(e,0,i,n,!0),o=[];if(!a||a.next===a.prev)return o;let s,c,l;if(r&&(a=jf(e,t,a,n)),e.length>80*n){s=e[0],c=e[1];let t=s,r=c;for(let a=n;a<i;a+=n){let n=e[a],i=e[a+1];n<s&&(s=n),i<c&&(c=i),n>t&&(t=n),i>r&&(r=i)}l=Math.max(t-s,r-c),l=l===0?0:32767/l}return Ef(a,o,n,s,c,l,0),o}function wf(e,t,n,r,i){let a;if(i===tp(e,t,n,r)>0)for(let i=t;i<n;i+=r)a=Qf(i/r|0,e[i],e[i+1],a);else for(let i=n-r;i>=t;i-=r)a=Qf(i/r|0,e[i],e[i+1],a);return a&&Wf(a,a.next)&&($f(a),a=a.next),a}function Tf(e,t){if(!e)return e;t||=e;let n=e,r;do if(r=!1,!n.steiner&&(Wf(n,n.next)||Uf(n.prev,n,n.next)===0)){if($f(n),n=t=n.prev,n===n.next)break;r=!0}else n=n.next;while(r||n!==t);return t}function Ef(e,t,n,r,i,a,o){if(!e)return;!o&&a&&If(e,r,i,a);let s=e;for(;e.prev!==e.next;){let c=e.prev,l=e.next;if(a?Of(e,r,i,a):Df(e)){t.push(c.i,e.i,l.i),$f(e),e=l.next,s=l.next;continue}if(e=l,e===s){o?o===1?(e=kf(Tf(e),t),Ef(e,t,n,r,i,a,2)):o===2&&Af(e,t,n,r,i,a):Ef(Tf(e),t,n,r,i,a,1);break}}}function Df(e){let t=e.prev,n=e,r=e.next;if(Uf(t,n,r)>=0)return!1;let i=t.x,a=n.x,o=r.x,s=t.y,c=n.y,l=r.y,u=Math.min(i,a,o),d=Math.min(s,c,l),f=Math.max(i,a,o),p=Math.max(s,c,l),m=r.next;for(;m!==t;){if(m.x>=u&&m.x<=f&&m.y>=d&&m.y<=p&&Vf(i,s,a,c,o,l,m.x,m.y)&&Uf(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Of(e,t,n,r){let i=e.prev,a=e,o=e.next;if(Uf(i,a,o)>=0)return!1;let s=i.x,c=a.x,l=o.x,u=i.y,d=a.y,f=o.y,p=Math.min(s,c,l),m=Math.min(u,d,f),h=Math.max(s,c,l),g=Math.max(u,d,f),_=Rf(p,m,t,n,r),v=Rf(h,g,t,n,r),y=e.prevZ,b=e.nextZ;for(;y&&y.z>=_&&b&&b.z<=v;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Vf(s,u,c,d,l,f,y.x,y.y)&&Uf(y.prev,y,y.next)>=0||(y=y.prevZ,b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Vf(s,u,c,d,l,f,b.x,b.y)&&Uf(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;y&&y.z>=_;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Vf(s,u,c,d,l,f,y.x,y.y)&&Uf(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;b&&b.z<=v;){if(b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Vf(s,u,c,d,l,f,b.x,b.y)&&Uf(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function kf(e,t){let n=e;do{let r=n.prev,i=n.next.next;!Wf(r,i)&&Gf(r,n,n.next,i)&&Yf(r,i)&&Yf(i,r)&&(t.push(r.i,n.i,i.i),$f(n),$f(n.next),n=e=i),n=n.next}while(n!==e);return Tf(n)}function Af(e,t,n,r,i,a){let o=e;do{let e=o.next.next;for(;e!==o.prev;){if(o.i!==e.i&&Hf(o,e)){let s=Zf(o,e);o=Tf(o,o.next),s=Tf(s,s.next),Ef(o,t,n,r,i,a,0),Ef(s,t,n,r,i,a,0);return}e=e.next}o=o.next}while(o!==e)}function jf(e,t,n,r){let i=[];for(let n=0,a=t.length;n<a;n++){let o=wf(e,t[n]*r,n<a-1?t[n+1]*r:e.length,r,!1);o===o.next&&(o.steiner=!0),i.push(zf(o))}i.sort(Mf);for(let e=0;e<i.length;e++)n=Nf(i[e],n);return n}function Mf(e,t){let n=e.x-t.x;return n===0&&(n=e.y-t.y,n===0&&(n=(e.next.y-e.y)/(e.next.x-e.x)-(t.next.y-t.y)/(t.next.x-t.x))),n}function Nf(e,t){let n=Pf(e,t);if(!n)return t;let r=Zf(n,e);return Tf(r,r.next),Tf(n,n.next)}function Pf(e,t){let n=t,r=e.x,i=e.y,a=-1/0,o;if(Wf(e,n))return n;do{if(Wf(e,n.next))return n.next;if(i<=n.y&&i>=n.next.y&&n.next.y!==n.y){let e=n.x+(i-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(e<=r&&e>a&&(a=e,o=n.x<n.next.x?n:n.next,e===r))return o}n=n.next}while(n!==t);if(!o)return null;let s=o,c=o.x,l=o.y,u=1/0;n=o;do{if(r>=n.x&&n.x>=c&&r!==n.x&&Bf(i<l?r:a,i,c,l,i<l?a:r,i,n.x,n.y)){let t=Math.abs(i-n.y)/(r-n.x);Yf(n,e)&&(t<u||t===u&&(n.x>o.x||n.x===o.x&&Ff(o,n)))&&(o=n,u=t)}n=n.next}while(n!==s);return o}function Ff(e,t){return Uf(e.prev,e,t.prev)<0&&Uf(t.next,e,e.next)<0}function If(e,t,n,r){let i=e;do i.z===0&&(i.z=Rf(i.x,i.y,t,n,r)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==e);i.prevZ.nextZ=null,i.prevZ=null,Lf(i)}function Lf(e){let t,n=1;do{let r=e,i;e=null;let a=null;for(t=0;r;){t++;let o=r,s=0;for(let e=0;e<n&&(s++,o=o.nextZ,o);e++);let c=n;for(;s>0||c>0&&o;)s!==0&&(c===0||!o||r.z<=o.z)?(i=r,r=r.nextZ,s--):(i=o,o=o.nextZ,c--),a?a.nextZ=i:e=i,i.prevZ=a,a=i;r=o}a.nextZ=null,n*=2}while(t>1);return e}function Rf(e,t,n,r,i){return e=(e-n)*i|0,t=(t-r)*i|0,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,e|t<<1}function zf(e){let t=e,n=e;do(t.x<n.x||t.x===n.x&&t.y<n.y)&&(n=t),t=t.next;while(t!==e);return n}function Bf(e,t,n,r,i,a,o,s){return(i-o)*(t-s)>=(e-o)*(a-s)&&(e-o)*(r-s)>=(n-o)*(t-s)&&(n-o)*(a-s)>=(i-o)*(r-s)}function Vf(e,t,n,r,i,a,o,s){return!(e===o&&t===s)&&Bf(e,t,n,r,i,a,o,s)}function Hf(e,t){return e.next.i!==t.i&&e.prev.i!==t.i&&!Jf(e,t)&&(Yf(e,t)&&Yf(t,e)&&Xf(e,t)&&(Uf(e.prev,e,t.prev)||Uf(e,t.prev,t))||Wf(e,t)&&Uf(e.prev,e,e.next)>0&&Uf(t.prev,t,t.next)>0)}function Uf(e,t,n){return(t.y-e.y)*(n.x-t.x)-(t.x-e.x)*(n.y-t.y)}function Wf(e,t){return e.x===t.x&&e.y===t.y}function Gf(e,t,n,r){let i=qf(Uf(e,t,n)),a=qf(Uf(e,t,r)),o=qf(Uf(n,r,e)),s=qf(Uf(n,r,t));return!!(i!==a&&o!==s||i===0&&Kf(e,n,t)||a===0&&Kf(e,r,t)||o===0&&Kf(n,e,r)||s===0&&Kf(n,t,r))}function Kf(e,t,n){return t.x<=Math.max(e.x,n.x)&&t.x>=Math.min(e.x,n.x)&&t.y<=Math.max(e.y,n.y)&&t.y>=Math.min(e.y,n.y)}function qf(e){return e>0?1:e<0?-1:0}function Jf(e,t){let n=e;do{if(n.i!==e.i&&n.next.i!==e.i&&n.i!==t.i&&n.next.i!==t.i&&Gf(n,n.next,e,t))return!0;n=n.next}while(n!==e);return!1}function Yf(e,t){return Uf(e.prev,e,e.next)<0?Uf(e,t,e.next)>=0&&Uf(e,e.prev,t)>=0:Uf(e,t,e.prev)<0||Uf(e,e.next,t)<0}function Xf(e,t){let n=e,r=!1,i=(e.x+t.x)/2,a=(e.y+t.y)/2;do n.y>a!=n.next.y>a&&n.next.y!==n.y&&i<(n.next.x-n.x)*(a-n.y)/(n.next.y-n.y)+n.x&&(r=!r),n=n.next;while(n!==e);return r}function Zf(e,t){let n=ep(e.i,e.x,e.y),r=ep(t.i,t.x,t.y),i=e.next,a=t.prev;return e.next=t,t.prev=e,n.next=i,i.prev=n,r.next=n,n.prev=r,a.next=r,r.prev=a,r}function Qf(e,t,n,r){let i=ep(e,t,n);return r?(i.next=r.next,i.prev=r,r.next.prev=i,r.next=i):(i.prev=i,i.next=i),i}function $f(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function ep(e,t,n){return{i:e,x:t,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function tp(e,t,n,r){let i=0;for(let a=t,o=n-r;a<n;a+=r)i+=(e[o]-e[a])*(e[a+1]+e[o+1]),o=a;return i}var np=class{static triangulate(e,t,n=2){return Cf(e,t,n)}},rp=class e{static area(e){let t=e.length,n=0;for(let r=t-1,i=0;i<t;r=i++)n+=e[r].x*e[i].y-e[i].x*e[r].y;return n*.5}static isClockWise(t){return e.area(t)<0}static triangulateShape(e,t){let n=[],r=[],i=[];ip(e),ap(n,e);let a=e.length;t.forEach(ip);for(let e=0;e<t.length;e++)r.push(a),a+=t[e].length,ap(n,t[e]);let o=np.triangulate(n,r);for(let e=0;e<o.length;e+=3)i.push(o.slice(e,e+3));return i}};function ip(e){let t=e.length;t>2&&e[t-1].equals(e[0])&&e.pop()}function ap(e,t){for(let n=0;n<t.length;n++)e.push(t[n].x),e.push(t[n].y)}var op=class e extends Ou{constructor(e=new Sf([new G(.5,.5),new G(-.5,.5),new G(-.5,-.5),new G(.5,-.5)]),t={}){super(),this.type=`ExtrudeGeometry`,this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,r=[],i=[];for(let t=0,n=e.length;t<n;t++){let n=e[t];a(n)}this.setAttribute(`position`,new J(r,3)),this.setAttribute(`uv`,new J(i,2)),this.computeVertexNormals();function a(e){let a=[],o=t.curveSegments===void 0?12:t.curveSegments,s=t.steps===void 0?1:t.steps,c=t.depth===void 0?1:t.depth,l=t.bevelEnabled===void 0?!0:t.bevelEnabled,u=t.bevelThickness===void 0?.2:t.bevelThickness,d=t.bevelSize===void 0?u-.1:t.bevelSize,f=t.bevelOffset===void 0?0:t.bevelOffset,p=t.bevelSegments===void 0?3:t.bevelSegments,m=t.extrudePath,h=t.UVGenerator===void 0?sp:t.UVGenerator,g,_=!1,v,y,b,x;if(m){g=m.getSpacedPoints(s),_=!0,l=!1;let e=m.isCatmullRomCurve3?m.closed:!1;v=m.computeFrenetFrames(s,e),y=new K,b=new K,x=new K}l||(p=0,u=0,d=0,f=0);let S=e.extractPoints(o),C=S.shape,w=S.holes;if(!rp.isClockWise(C)){C=C.reverse();for(let e=0,t=w.length;e<t;e++){let t=w[e];rp.isClockWise(t)&&(w[e]=t.reverse())}}function T(e){let t=1e-10;t*t;let n=e[0];for(let t=1;t<=e.length;t++){let r=t%e.length,i=e[r],a=i.x-n.x,o=i.y-n.y,s=a*a+o*o,c=Math.max(Math.abs(i.x),Math.abs(i.y),Math.abs(n.x),Math.abs(n.y));if(s<=10000000000000001e-36*c*c){e.splice(r,1),t--;continue}n=i}}T(C),w.forEach(T);let E=w.length,D=C;for(let e=0;e<E;e++){let t=w[e];C=C.concat(t)}function O(e,t,n){return t||W(`ExtrudeGeometry: vec does not exist`),e.clone().addScaledVector(t,n)}let k=C.length;function A(e,t,n){let r,i,a,o=e.x-t.x,s=e.y-t.y,c=n.x-e.x,l=n.y-e.y,u=o*o+s*s,d=o*l-s*c;if(Math.abs(d)>2**-52){let d=Math.sqrt(u),f=Math.sqrt(c*c+l*l),p=t.x-s/d,m=t.y+o/d,h=n.x-l/f,g=n.y+c/f,_=((h-p)*l-(g-m)*c)/(o*l-s*c);r=p+o*_-e.x,i=m+s*_-e.y;let v=r*r+i*i;if(v<=2)return new G(r,i);a=Math.sqrt(v/2)}else{let e=!1;o>2**-52?c>2**-52&&(e=!0):o<-(2**-52)?c<-(2**-52)&&(e=!0):Math.sign(s)===Math.sign(l)&&(e=!0),e?(r=-s,i=o,a=Math.sqrt(u)):(r=o,i=s,a=Math.sqrt(u/2))}return new G(r/a,i/a)}let j=[];for(let e=0,t=D.length,n=t-1,r=e+1;e<t;e++,n++,r++)n===t&&(n=0),r===t&&(r=0),j[e]=A(D[e],D[n],D[r]);let ee=[],M,te=j.concat();for(let e=0,t=E;e<t;e++){let t=w[e];M=[];for(let e=0,n=t.length,r=n-1,i=e+1;e<n;e++,r++,i++)r===n&&(r=0),i===n&&(i=0),M[e]=A(t[e],t[r],t[i]);ee.push(M),te=te.concat(M)}let N;if(p===0)N=rp.triangulateShape(D,w);else{let e=[],t=[];for(let n=0;n<p;n++){let r=n/p,i=u*Math.cos(r*Math.PI/2),a=d*Math.sin(r*Math.PI/2)+f;for(let t=0,n=D.length;t<n;t++){let n=O(D[t],j[t],a);F(n.x,n.y,-i),r===0&&e.push(n)}for(let e=0,n=E;e<n;e++){let n=w[e];M=ee[e];let o=[];for(let e=0,t=n.length;e<t;e++){let t=O(n[e],M[e],a);F(t.x,t.y,-i),r===0&&o.push(t)}r===0&&t.push(o)}}N=rp.triangulateShape(e,t)}let P=N.length,ne=d+f;for(let e=0;e<k;e++){let t=l?O(C[e],te[e],ne):C[e];_?(b.copy(v.normals[0]).multiplyScalar(t.x),y.copy(v.binormals[0]).multiplyScalar(t.y),x.copy(g[0]).add(b).add(y),F(x.x,x.y,x.z)):F(t.x,t.y,0)}for(let e=1;e<=s;e++)for(let t=0;t<k;t++){let n=l?O(C[t],te[t],ne):C[t];_?(b.copy(v.normals[e]).multiplyScalar(n.x),y.copy(v.binormals[e]).multiplyScalar(n.y),x.copy(g[e]).add(b).add(y),F(x.x,x.y,x.z)):F(n.x,n.y,c/s*e)}for(let e=p-1;e>=0;e--){let t=e/p,n=u*Math.cos(t*Math.PI/2),r=d*Math.sin(t*Math.PI/2)+f;for(let e=0,t=D.length;e<t;e++){let t=O(D[e],j[e],r);F(t.x,t.y,c+n)}for(let e=0,t=w.length;e<t;e++){let t=w[e];M=ee[e];for(let e=0,i=t.length;e<i;e++){let i=O(t[e],M[e],r);_?F(i.x,i.y+g[s-1].y,g[s-1].x+n):F(i.x,i.y,c+n)}}}re(),ie();function re(){let e=r.length/3;if(l){let e=0,t=k*e;for(let e=0;e<P;e++){let n=N[e];oe(n[2]+t,n[1]+t,n[0]+t)}e=s+p*2,t=k*e;for(let e=0;e<P;e++){let n=N[e];oe(n[0]+t,n[1]+t,n[2]+t)}}else{for(let e=0;e<P;e++){let t=N[e];oe(t[2],t[1],t[0])}for(let e=0;e<P;e++){let t=N[e];oe(t[0]+k*s,t[1]+k*s,t[2]+k*s)}}n.addGroup(e,r.length/3-e,0)}function ie(){let e=r.length/3,t=0;ae(D,t),t+=D.length;for(let e=0,n=w.length;e<n;e++){let n=w[e];ae(n,t),t+=n.length}n.addGroup(e,r.length/3-e,1)}function ae(e,t){let n=e.length;for(;--n>=0;){let r=n,i=n-1;i<0&&(i=e.length-1);for(let e=0,n=s+p*2;e<n;e++){let n=k*e,a=k*(e+1);se(t+r+n,t+i+n,t+i+a,t+r+a)}}}function F(e,t,n){a.push(e),a.push(t),a.push(n)}function oe(e,t,i){I(e),I(t),I(i);let a=r.length/3,o=h.generateTopUV(n,r,a-3,a-2,a-1);L(o[0]),L(o[1]),L(o[2])}function se(e,t,i,a){I(e),I(t),I(a),I(t),I(i),I(a);let o=r.length/3,s=h.generateSideWallUV(n,r,o-6,o-3,o-2,o-1);L(s[0]),L(s[1]),L(s[3]),L(s[1]),L(s[2]),L(s[3])}function I(e){r.push(a[e*3+0]),r.push(a[e*3+1]),r.push(a[e*3+2])}function L(e){i.push(e.x),i.push(e.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return cp(t,n,e)}static fromJSON(t,n){let r=[];for(let e=0,i=t.shapes.length;e<i;e++){let i=n[t.shapes[e]];r.push(i)}let i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new yf[i.type]().fromJSON(i)),new e(r,t.options)}},sp={generateTopUV:function(e,t,n,r,i){let a=t[n*3],o=t[n*3+1],s=t[r*3],c=t[r*3+1],l=t[i*3],u=t[i*3+1];return[new G(a,o),new G(s,c),new G(l,u)]},generateSideWallUV:function(e,t,n,r,i,a){let o=t[n*3],s=t[n*3+1],c=t[n*3+2],l=t[r*3],u=t[r*3+1],d=t[r*3+2],f=t[i*3],p=t[i*3+1],m=t[i*3+2],h=t[a*3],g=t[a*3+1],_=t[a*3+2];return Math.abs(s-u)<Math.abs(o-l)?[new G(o,1-c),new G(l,1-d),new G(f,1-m),new G(h,1-_)]:[new G(s,1-c),new G(u,1-d),new G(p,1-m),new G(g,1-_)]}};function cp(e,t,n){if(n.shapes=[],Array.isArray(e))for(let t=0,r=e.length;t<r;t++){let r=e[t];n.shapes.push(r.uuid)}else n.shapes.push(e.uuid);return n.options=Object.assign({},t),t.extrudePath!==void 0&&(n.options.extrudePath=t.extrudePath.toJSON()),n}var lp=class e extends Ud{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1];super(r,[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type=`IcosahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},up=class e extends Ou{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new J(p,3)),this.setAttribute(`normal`,new J(m,3)),this.setAttribute(`uv`,new J(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}},dp=class e extends Ou{constructor(e=.5,t=1,n=32,r=1,i=0,a=Math.PI*2){super(),this.type=`RingGeometry`,this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:r,thetaStart:i,thetaLength:a},n=Math.max(3,n),r=Math.max(1,r);let o=[],s=[],c=[],l=[],u=e,d=(t-e)/r,f=new K,p=new G;for(let e=0;e<=r;e++){for(let e=0;e<=n;e++){let r=i+e/n*a;f.x=u*Math.cos(r),f.y=u*Math.sin(r),s.push(f.x,f.y,f.z),c.push(0,0,1),p.x=(f.x/t+1)/2,p.y=(f.y/t+1)/2,l.push(p.x,p.y)}u+=d}for(let e=0;e<r;e++){let t=e*(n+1);for(let e=0;e<n;e++){let r=e+t,i=r,a=r+n+1,s=r+n+2,c=r+1;o.push(i,a,c),o.push(a,s,c)}}this.setIndex(o),this.setAttribute(`position`,new J(s,3)),this.setAttribute(`normal`,new J(c,3)),this.setAttribute(`uv`,new J(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}},fp=class e extends Ou{constructor(e=new Sf([new G(0,.5),new G(-.5,-.5),new G(.5,-.5)]),t=12){super(),this.type=`ShapeGeometry`,this.parameters={shapes:e,curveSegments:t};let n=[],r=[],i=[],a=[],o=0,s=0;if(Array.isArray(e)===!1)c(e);else for(let t=0;t<e.length;t++)c(e[t]),this.addGroup(o,s,t),o+=s,s=0;this.setIndex(n),this.setAttribute(`position`,new J(r,3)),this.setAttribute(`normal`,new J(i,3)),this.setAttribute(`uv`,new J(a,2));function c(e){let o=r.length/3,c=e.extractPoints(t),l=c.shape,u=c.holes;rp.isClockWise(l)===!1&&(l=l.reverse());for(let e=0,t=u.length;e<t;e++){let t=u[e];rp.isClockWise(t)===!0&&(u[e]=t.reverse())}let d=rp.triangulateShape(l,u);for(let e=0,t=u.length;e<t;e++){let t=u[e];l=l.concat(t)}for(let e=0,t=l.length;e<t;e++){let t=l[e];r.push(t.x,t.y,0),i.push(0,0,1),a.push(t.x,t.y)}for(let e=0,t=d.length;e<t;e++){let t=d[e],r=t[0]+o,i=t[1]+o,a=t[2]+o;n.push(r,i,a),s+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes;return pp(t,e)}static fromJSON(t,n){let r=[];for(let e=0,i=t.shapes.length;e<i;e++){let i=n[t.shapes[e]];r.push(i)}return new e(r,t.curveSegments)}};function pp(e,t){if(t.shapes=[],Array.isArray(e))for(let n=0,r=e.length;n<r;n++){let r=e[n];t.shapes.push(r.uuid)}else t.shapes.push(e.uuid);return t}var mp=class e extends Ou{constructor(e=1,t=32,n=16,r=0,i=Math.PI*2,a=0,o=Math.PI){super(),this.type=`SphereGeometry`,this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:i,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let s=Math.min(a+o,Math.PI),c=0,l=[],u=new K,d=new K,f=[],p=[],m=[],h=[];for(let f=0;f<=n;f++){let g=[],_=f/n,v=a+_*o,y=e*Math.cos(v),b=Math.sqrt(e*e-y*y),x=0;f===0&&a===0?x=.5/t:f===n&&s===Math.PI&&(x=-.5/t);for(let e=0;e<=t;e++){let n=e/t,a=r+n*i;u.x=-b*Math.cos(a),u.y=y,u.z=b*Math.sin(a),p.push(u.x,u.y,u.z),d.copy(u).normalize(),m.push(d.x,d.y,d.z),h.push(n+x,1-_),g.push(c++)}l.push(g)}for(let e=0;e<n;e++)for(let r=0;r<t;r++){let t=l[e][r+1],i=l[e][r],o=l[e+1][r],c=l[e+1][r+1];(e!==0||a>0)&&f.push(t,i,c),(e!==n-1||s<Math.PI)&&f.push(i,o,c)}this.setIndex(f),this.setAttribute(`position`,new J(p,3)),this.setAttribute(`normal`,new J(m,3)),this.setAttribute(`uv`,new J(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}},hp=class e extends Ou{constructor(e=1,t=.4,n=12,r=48,i=Math.PI*2,a=0,o=Math.PI*2){super(),this.type=`TorusGeometry`,this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:r,arc:i,thetaStart:a,thetaLength:o},n=Math.floor(n),r=Math.floor(r);let s=[],c=[],l=[],u=[],d=new K,f=new K,p=new K;for(let s=0;s<=n;s++){let m=a+s/n*o;for(let a=0;a<=r;a++){let o=a/r*i;f.x=(e+t*Math.cos(m))*Math.cos(o),f.y=(e+t*Math.cos(m))*Math.sin(o),f.z=t*Math.sin(m),c.push(f.x,f.y,f.z),d.x=e*Math.cos(o),d.y=e*Math.sin(o),p.subVectors(f,d).normalize(),l.push(p.x,p.y,p.z),u.push(a/r),u.push(s/n)}}for(let e=1;e<=n;e++)for(let t=1;t<=r;t++){let n=(r+1)*e+t-1,i=(r+1)*(e-1)+t-1,a=(r+1)*(e-1)+t,o=(r+1)*e+t;s.push(n,i,o),s.push(i,a,o)}this.setIndex(s),this.setAttribute(`position`,new J(c,3)),this.setAttribute(`normal`,new J(l,3)),this.setAttribute(`uv`,new J(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc,t.thetaStart,t.thetaLength)}};function gp(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(vp(i))i.isRenderTargetTexture?(U(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i))if(vp(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice();else t[n][r]=i}}return t}function _p(e){let t={};for(let n=0;n<e.length;n++){let r=gp(e[n]);for(let e in r)t[e]=r[e]}return t}function vp(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function yp(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function bp(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Ic.workingColorSpace}var xp={clone:gp,merge:_p},Sp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Cp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,wp=class extends Pu{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Sp,this.fragmentShader=Cp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=gp(e.uniforms),this.uniformsGroups=yp(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new q().setHex(r.value);break;case`v2`:this.uniforms[n].value=new G().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new K().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new qc().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new jc().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new Qc().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Tp=class extends wp{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},Ep=class extends Pu{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new q(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new q(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new G(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cl,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Dp=class extends Pu{constructor(e){super(),this.isMeshPhongMaterial=!0,this.type=`MeshPhongMaterial`,this.color=new q(16777215),this.specular=new q(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new q(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new G(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cl,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Op=class extends Pu{constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:``},this.type=`MeshToonMaterial`,this.color=new q(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new q(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new G(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},kp=class extends Pu{constructor(e){super(),this.isMeshNormalMaterial=!0,this.type=`MeshNormalMaterial`,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new G(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}},Ap=class extends Pu{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type=`MeshLambertMaterial`,this.color=new q(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new q(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new G(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new cl,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},jp=class extends Pu{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=Ns,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Mp=class extends Pu{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Np(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}function Pp(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}var Fp=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},Ip=class extends Fp{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:As,endingEnd:As}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case js:i=e,o=2*t-n;break;case Ms:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case js:a=e,s=2*n-t;break;case Ms:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},Lp=class extends Fp{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},Rp=class extends Fp{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},zp=class extends Fp{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1];i[p]=Bp(Hp(n,t,g,y,r),o,_,b,m)}return i}};function Bp(e,t,n,r,i){let a=1-e;return a*a*a*t+3*a*a*e*n+3*a*e*e*r+e*e*e*i}function Vp(e,t,n,r,i){let a=1-e;return 3*a*a*(n-t)+6*a*e*(r-n)+3*e*e*(i-r)}function Hp(e,t,n,r,i){let a=(e-t)/(i-t);for(let o=0;o<8;o++){let o=Bp(a,t,n,r,i)-e;if(Math.abs(o)<1e-10)break;let s=Vp(a,t,n,r,i);if(Math.abs(s)<1e-10)break;a=Math.max(0,Math.min(1,a-o/s))}return a}var Up=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=Np(t,this.TimeBufferType),this.values=Np(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Np(e.times,Array),values:Np(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t),Pp(e.settings)&&(n.settings={inTangents:Np(e.settings.inTangents,Array),outTangents:Np(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Rp(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Lp(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Ip(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new zp(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Es:t=this.InterpolantFactoryMethodDiscrete;break;case Ds:t=this.InterpolantFactoryMethodLinear;break;case Os:t=this.InterpolantFactoryMethodSmooth;break;case ks:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t);return U(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Es;case this.InterpolantFactoryMethodLinear:return Ds;case this.InterpolantFactoryMethodSmooth:return Os;case this.InterpolantFactoryMethodBezier:return ks}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;Pp(this.settings)&&(Wp(this.settings.inTangents,e),Wp(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(W(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(W(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){W(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){W(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&Ws(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){W(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Os,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0]))if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,Pp(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function Wp(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]*=t}Up.prototype.ValueTypeName=``,Up.prototype.TimeBufferType=Float32Array,Up.prototype.ValueBufferType=Float32Array,Up.prototype.DefaultInterpolation=Ds;var Gp=class extends Up{constructor(e,t,n){super(e,t,n)}};Gp.prototype.ValueTypeName=`bool`,Gp.prototype.ValueBufferType=Array,Gp.prototype.DefaultInterpolation=Es,Gp.prototype.InterpolantFactoryMethodLinear=void 0,Gp.prototype.InterpolantFactoryMethodSmooth=void 0;var Kp=class extends Up{constructor(e,t,n,r){super(e,t,n,r)}};Kp.prototype.ValueTypeName=`color`;var qp=class extends Up{constructor(e,t,n,r){super(e,t,n,r)}};qp.prototype.ValueTypeName=`number`;var Jp=class extends Fp{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)Oc.slerpFlat(i,0,a,c-o,a,c,s);return i}},Yp=class extends Up{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Jp(this.times,this.values,this.getValueSize(),e)}};Yp.prototype.ValueTypeName=`quaternion`,Yp.prototype.InterpolantFactoryMethodSmooth=void 0;var Xp=class extends Up{constructor(e,t,n){super(e,t,n)}};Xp.prototype.ValueTypeName=`string`,Xp.prototype.ValueBufferType=Array,Xp.prototype.DefaultInterpolation=Es,Xp.prototype.InterpolantFactoryMethodLinear=void 0,Xp.prototype.InterpolantFactoryMethodSmooth=void 0;var Zp=class extends Up{constructor(e,t,n,r){super(e,t,n,r)}};Zp.prototype.ValueTypeName=`vector`;var Qp=new class{constructor(e,t,n){let r=this,i=!1,a=0,o=0,s,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(e){o++,i===!1&&r.onStart!==void 0&&r.onStart(e,a,o),i=!0},this.itemEnd=function(e){a++,r.onProgress!==void 0&&r.onProgress(e,a,o),a===o&&(i=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(e){r.onError!==void 0&&r.onError(e)},this.resolveURL=function(e){return e=e.normalize(`NFC`),s?s(e):e},this.setURLModifier=function(e){return s=e,this},this.addHandler=function(e,t){return c.push(e,t),this},this.removeHandler=function(e){let t=c.indexOf(e);return t!==-1&&c.splice(t,2),this},this.getHandler=function(e){for(let t=0,n=c.length;t<n;t+=2){let n=c[t],r=c[t+1];if(n.global&&(n.lastIndex=0),n.test(e))return r}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||=new AbortController,this._abortController}},$p=class{constructor(e){this.manager=e===void 0?Qp:e,this.crossOrigin=`anonymous`,this.withCredentials=!1,this.path=``,this.resourcePath=``,this.requestHeader={},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,i){n.load(e,r,t,i)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};$p.DEFAULT_MATERIAL_NAME=`__DEFAULT`;var em=class extends Tl{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new q(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},tm=class extends em{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type=`HemisphereLight`,this.position.copy(Tl.DEFAULT_UP),this.updateMatrix(),this.groundColor=new q(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},nm=new Qc,rm=new K,im=new K,am=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new G(512,512),this.mapType=xo,this.map=null,this.mapPass=null,this.matrix=new Qc,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new gd,this._frameExtents=new G(1,1),this._viewportCount=1,this._viewports=[new qc(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;rm.setFromMatrixPosition(e.matrixWorld),t.position.copy(rm),im.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(im),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,r){nm.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(nm,e.coordinateSystem,e.reversedDepth);let i=this._frameExtents,a=r?r.z/i.x:1,o=r?r.w/i.y:1,s=r?r.x/i.x:0,c=r?r.y/i.y:0;e.coordinateSystem===2001||e.reversedDepth?t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(nm)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},om=new K,sm=new Oc,cm=new K,lm=class extends Tl{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new Qc,this.projectionMatrix=new Qc,this.projectionMatrixInverse=new Qc,this.coordinateSystem=Hs,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(om,sm,cm),cm.x===1&&cm.y===1&&cm.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(om,sm,cm.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(om,sm,cm),cm.x===1&&cm.y===1&&cm.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(om,sm,cm.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},um=new K,dm=new G,fm=new G,pm=class extends lm{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=ic*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(rc*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return ic*2*Math.atan(Math.tan(rc*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){um.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(um.x,um.y).multiplyScalar(-e/um.z),um.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(um.x,um.y).multiplyScalar(-e/um.z)}getViewSize(e,t){return this.getViewBounds(e,dm,fm),t.subVectors(fm,dm)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(rc*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},mm=class extends am{constructor(){super(new pm(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=ic*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height*this.aspect,i=e.distance||t.far;(n!==t.fov||r!==t.aspect||i!==t.far)&&(t.fov=n,t.aspect=r,t.far=i,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},hm=class extends em{constructor(e,t,n=0,r=Math.PI/3,i=0,a=2){super(e,t),this.isSpotLight=!0,this.type=`SpotLight`,this.position.copy(Tl.DEFAULT_UP),this.updateMatrix(),this.target=new Tl,this.distance=n,this.angle=r,this.penumbra=i,this.decay=a,this.map=null,this.shadow=new mm}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},gm=class extends am{constructor(){super(new pm(90,1,.5,500)),this.isPointLightShadow=!0}},_m=class extends em{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type=`PointLight`,this.distance=n,this.decay=r,this.shadow=new gm}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},vm=class extends lm{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},ym=class extends am{constructor(){super(new vm(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},bm=class extends em{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(Tl.DEFAULT_UP),this.updateMatrix(),this.target=new Tl,this.shadow=new ym}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},xm=-90,Sm=1,Cm=class extends Tl{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new pm(xm,Sm,e,t);r.layers=this.layers,this.add(r);let i=new pm(xm,Sm,e,t);i.layers=this.layers,this.add(i);let a=new pm(xm,Sm,e,t);a.layers=this.layers,this.add(a);let o=new pm(xm,Sm,e,t);o.layers=this.layers,this.add(o);let s=new pm(xm,Sm,e,t);s.layers=this.layers,this.add(s);let c=new pm(xm,Sm,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},wm=class extends pm{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Tm=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=Em.bind(this),e.addEventListener(`visibilitychange`,this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener(`visibilitychange`,this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e===void 0?performance.now():e)-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function Em(){this._document.hidden===!1&&this.reset()}var Dm=`\\[\\]\\.:\\/`,Om=RegExp(`[`+Dm+`]`,`g`),km=`[^`+Dm+`]`,Am=`[^`+Dm.replace(`\\.`,``)+`]`,jm=`((?:WC+[\\/:])*)`.replace(`WC`,km),Mm=`(WCOD+)?`.replace(`WCOD`,Am),Nm=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,km),Pm=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,km),Fm=RegExp(`^`+jm+Mm+Nm+Pm+`$`),Im=[`material`,`materials`,`bones`,`map`],Lm=class{constructor(e,t,n){let r=n||Rm.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Rm=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(Om,``)}static parseTrackName(e){let t=Fm.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);Im.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){U(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){W(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){W(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){W(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){W(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){W(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){W(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){W(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;W(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){W(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){W(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Rm.Composite=Lm,Rm.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Rm.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Rm.prototype.GetterByBindingType=[Rm.prototype._getValue_direct,Rm.prototype._getValue_array,Rm.prototype._getValue_arrayElement,Rm.prototype._getValue_toArray],Rm.prototype.SetterByBindingTypeAndVersioning=[[Rm.prototype._setValue_direct,Rm.prototype._setValue_direct_setNeedsUpdate,Rm.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Rm.prototype._setValue_array,Rm.prototype._setValue_array_setNeedsUpdate,Rm.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Rm.prototype._setValue_arrayElement,Rm.prototype._setValue_arrayElement_setNeedsUpdate,Rm.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Rm.prototype._setValue_fromArray,Rm.prototype._setValue_fromArray_setNeedsUpdate,Rm.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var zm=new Qc,Bm=class{constructor(e,t,n=0,r=1/0){this.ray=new Hu(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new ll,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):W(`Raycaster: Unsupported camera type: `+t.type)}setFromXRController(e){return zm.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(zm),this}intersectObject(e,t=!0,n=[]){return Hm(e,this,n,t),n.sort(Vm),n}intersectObjects(e,t=!0,n=[]){for(let r=0,i=e.length;r<i;r++)Hm(e[r],this,n,t);return n.sort(Vm),n}};function Vm(e,t){return e.distance-t.distance}function Hm(e,t,n,r){let i=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(i=!1),i===!0&&r===!0){let r=e.children;for(let e=0,i=r.length;e<i;e++)Hm(r[e],t,n,!0)}}var Um=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){let e=1e-6;return this.phi=oc(this.phi,e,Math.PI-e),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(oc(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});var Wm=class extends kd{constructor(e=10,t=10,n=4473924,r=8947848){n=new q(n),r=new q(r);let i=t/2,a=e/t,o=e/2,s=[],c=[];for(let e=0,l=0,u=-o;e<=t;e++,u+=a){s.push(-o,0,u,o,0,u),s.push(u,0,-o,u,0,o);let t=e===i?n:r;t.toArray(c,l),l+=3,t.toArray(c,l),l+=3,t.toArray(c,l),l+=3,t.toArray(c,l),l+=3}let l=new Ou;l.setAttribute(`position`,new J(s,3)),l.setAttribute(`color`,new J(c,3));let u=new _d({vertexColors:!0,toneMapped:!1});super(l,u),this.type=`GridHelper`}dispose(){super.dispose(),this.geometry.dispose(),this.material.dispose()}},Gm=class extends kd{constructor(e,t=16776960){let n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),r=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],i=new Ou;i.setIndex(new mu(n,1)),i.setAttribute(`position`,new J(r,3)),super(i,new _d({color:t,toneMapped:!1})),this.box=e,this.type=`Box3Helper`,this.geometry.computeBoundingSphere()}updateMatrixWorld(e){let t=this.box;t.isEmpty()||(t.getCenter(this.position),t.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(e))}dispose(){super.dispose(),this.geometry.dispose(),this.material.dispose()}},Km=class extends ec{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function qm(e,t,n,r){let i=Jm(r);switch(n){case Po:return e*t;case zo:return e*t/i.components*i.byteLength;case Bo:return e*t/i.components*i.byteLength;case Vo:return e*t*2/i.components*i.byteLength;case Ho:return e*t*2/i.components*i.byteLength;case Fo:return e*t*3/i.components*i.byteLength;case Io:return e*t*4/i.components*i.byteLength;case Uo:return e*t*4/i.components*i.byteLength;case Wo:case Go:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Ko:case qo:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Yo:case Zo:return Math.max(e,16)*Math.max(t,8)/4;case Jo:case Xo:return Math.max(e,8)*Math.max(t,8)/2;case Qo:case $o:case ts:case ns:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case es:case rs:case is:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case as:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case os:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case ss:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case cs:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case ls:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case us:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case ds:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case fs:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case ps:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case ms:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case hs:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case gs:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case _s:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case vs:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case ys:case bs:case xs:return Math.ceil(e/4)*Math.ceil(t/4)*16;case Ss:case Cs:return Math.ceil(e/4)*Math.ceil(t/4)*8;case ws:case Ts:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function Jm(e){switch(e){case xo:case So:return{byteLength:1,components:1};case wo:case Co:case Oo:return{byteLength:2,components:1};case ko:case Ao:return{byteLength:2,components:4};case Eo:case To:case Do:return{byteLength:4,components:1};case Mo:case No:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`186`}})),typeof window<`u`&&(window.__THREE__?U(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`186`);function Ym(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function Xm(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var Zm={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Q={common:{diffuse:{value:new q(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new jc},alphaMap:{value:null},alphaMapTransform:{value:new jc},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new jc}},envmap:{envMap:{value:null},envMapRotation:{value:new jc},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new jc}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new jc}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new jc},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new jc},normalScale:{value:new G(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new jc},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new jc}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new jc}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new jc}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new q(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new K},probesMax:{value:new K},probesResolution:{value:new K}},points:{diffuse:{value:new q(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new jc},alphaTest:{value:0},uvTransform:{value:new jc}},sprite:{diffuse:{value:new q(16777215)},opacity:{value:1},center:{value:new G(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new jc},alphaMap:{value:null},alphaMapTransform:{value:new jc},alphaTest:{value:0}}},Qm={basic:{uniforms:_p([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.fog]),vertexShader:Zm.meshbasic_vert,fragmentShader:Zm.meshbasic_frag},lambert:{uniforms:_p([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new q(0)},envMapIntensity:{value:1}}]),vertexShader:Zm.meshlambert_vert,fragmentShader:Zm.meshlambert_frag},phong:{uniforms:_p([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new q(0)},specular:{value:new q(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Zm.meshphong_vert,fragmentShader:Zm.meshphong_frag},standard:{uniforms:_p([Q.common,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.roughnessmap,Q.metalnessmap,Q.fog,Q.lights,{emissive:{value:new q(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Zm.meshphysical_vert,fragmentShader:Zm.meshphysical_frag},toon:{uniforms:_p([Q.common,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.gradientmap,Q.fog,Q.lights,{emissive:{value:new q(0)}}]),vertexShader:Zm.meshtoon_vert,fragmentShader:Zm.meshtoon_frag},matcap:{uniforms:_p([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,{matcap:{value:null}}]),vertexShader:Zm.meshmatcap_vert,fragmentShader:Zm.meshmatcap_frag},points:{uniforms:_p([Q.points,Q.fog]),vertexShader:Zm.points_vert,fragmentShader:Zm.points_frag},dashed:{uniforms:_p([Q.common,Q.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Zm.linedashed_vert,fragmentShader:Zm.linedashed_frag},depth:{uniforms:_p([Q.common,Q.displacementmap]),vertexShader:Zm.depth_vert,fragmentShader:Zm.depth_frag},normal:{uniforms:_p([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,{opacity:{value:1}}]),vertexShader:Zm.meshnormal_vert,fragmentShader:Zm.meshnormal_frag},sprite:{uniforms:_p([Q.sprite,Q.fog]),vertexShader:Zm.sprite_vert,fragmentShader:Zm.sprite_frag},background:{uniforms:{uvTransform:{value:new jc},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Zm.background_vert,fragmentShader:Zm.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new jc}},vertexShader:Zm.backgroundCube_vert,fragmentShader:Zm.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Zm.cube_vert,fragmentShader:Zm.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Zm.equirect_vert,fragmentShader:Zm.equirect_frag},distance:{uniforms:_p([Q.common,Q.displacementmap,{referencePosition:{value:new K},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Zm.distance_vert,fragmentShader:Zm.distance_frag},shadow:{uniforms:_p([Q.lights,Q.fog,{color:{value:new q(0)},opacity:{value:1}}]),vertexShader:Zm.shadow_vert,fragmentShader:Zm.shadow_frag}};Qm.physical={uniforms:_p([Qm.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new jc},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new jc},clearcoatNormalScale:{value:new G(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new jc},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new jc},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new jc},sheen:{value:0},sheenColor:{value:new q(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new jc},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new jc},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new jc},transmissionSamplerSize:{value:new G},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new jc},attenuationDistance:{value:0},attenuationColor:{value:new q(0)},specularColor:{value:new q(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new jc},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new jc},anisotropyVector:{value:new G},anisotropyMap:{value:null},anisotropyMapTransform:{value:new jc}}]),vertexShader:Zm.meshphysical_vert,fragmentShader:Zm.meshphysical_frag};var $m={r:0,b:0,g:0},eh=new Qc,th=new jc;th.set(-1,0,0,0,1,0,0,0,1);function nh(e,t,n,r,i,a){let o=new q(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new Y(new X(1,1,1),new wp({name:`BackgroundCubeMaterial`,uniforms:gp(Qm.backgroundCube.uniforms),vertexShader:Qm.backgroundCube.vertexShader,fragmentShader:Qm.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,`envMap`,{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(eh.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(th),l.material.toneMapped=Ic.getTransfer(i.colorSpace)!==Rs,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Y(new up(2,2),new wp({name:`BackgroundMaterial`,uniforms:gp(Qm.background.uniforms),vertexShader:Qm.background.vertexShader,fragmentShader:Qm.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,`map`,{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Ic.getTransfer(i.colorSpace)!==Rs,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB($m,bp(e)),n.buffers.color.setClear($m.r,$m.g,$m.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function rh(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function ih(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function ah(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return!(t!==1023&&r.convert(t)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(U(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&U(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function oh(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Mu,s=new jc,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var sh=4,ch=6,lh=20,uh=256,dh=new vm,fh=new q,ph=null,mh=0,hh=0,gh=!1,_h=new K,vh=new K,yh=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=_h}=i;ph=this._renderer.getRenderTarget(),mh=this._renderer.getActiveCubeFace(),hh=this._renderer.getActiveMipmapLevel(),gh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Eh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Th(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ph,mh,hh),this._renderer.xr.enabled=gh,e.scissorTest=!1,Sh(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ph=this._renderer.getRenderTarget(),mh=this._renderer.getActiveCubeFace(),hh=this._renderer.getActiveMipmapLevel(),gh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:vo,minFilter:vo,generateMipmaps:!1,type:Oo,format:Io,colorSpace:Is,depthBuffer:!1},r=xh(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=xh(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=bh(r)),this._blurMaterial=wh(r,e,t),this._ggxMaterial=Ch(r,e,t)}return r}_compileMaterial(e){let t=new Y(new Ou,e);this._renderer.compile(t,dh)}_sceneToCubeUV(e,t,n,r,i){let a=new pm(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(fh),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Y(new X,new Uu({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(fh),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;Sh(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Eh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Th());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;Sh(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,dh)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-sh?n-d+sh:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,Sh(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,dh),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,Sh(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,dh)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];Sh(t,3*l*(r>this._lodMax-sh?r-this._lodMax+sh:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,dh)}};function bh(e){let t=[],n=[],r=e,i=e-sh+1+ch;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?vh.set(1,r,n):e===1?vh.set(-n,1,-r):e===2?vh.set(-n,r,1):e===3?vh.set(-1,r,-n):e===4?vh.set(-n,-1,r):vh.set(n,r,-1),vh.toArray(l,(e*6+t)*3)}}let u=new Ou;u.setAttribute(`position`,new mu(c,3)),u.setAttribute(`outputDirection`,new mu(l,3)),n.push(new Y(u,null)),r>sh&&r--}return{lodMeshes:n,sizeLods:t}}function xh(e,t,n){let r=new Yc(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function Sh(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function Ch(e,t,n){return new wp({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:uh,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Dh(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function wh(e,t,n){return new wp({name:`SphericalGaussianBlur`,defines:{SAMPLES:lh,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Dh(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Th(){return new wp({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Dh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Eh(){return new wp({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Dh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Dh(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Oh=class extends Yc{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Ld(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new X(5,5,5),i=new wp({name:`CubemapFromEquirect`,uniforms:gp(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Y(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=vo),new Cm(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function kh(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304)if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}else{let r=n.image;if(r&&r.height>0){let i=new Oh(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}else return null}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new yh(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new yh(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function Ah(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Zs(`WebGLRenderer: `+e+` extension not supported.`),t}}}function jh(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?gu:hu)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Mh(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Nh(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:W(`WebGLInfo: Unknown draw mode:`,r);break}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Ph(e,t,n){let r=new WeakMap,i=new qc;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new Xc(h,p,m,u);g.type=Do,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new G(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Fh(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Ih={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Lh(e,t,n,r,i,a){let o=new Yc(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new Ou;l.setAttribute(`position`,new J([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new J([0,2,0,0,2,0],2));let u=new Tp({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new Y(l,u),f=new vm(-1,1,1,-1,0,1),p=null,m=null,h=!1,g,_=null,v=[],y=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<v.length;n++){let r=v[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){v=e,y=v.length>0&&v[0].isRenderPass===!0;let t=o.width,n=o.height;v.length>0&&s===null&&(s=new Yc(t,n,{type:Oo,depthBuffer:!1,stencilBuffer:!1}),c=new Yc(t,n,{type:Oo,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<v.length;e++){let r=v[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(h||e.toneMapping===0&&v.length===0)return!1;if(_=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return y===!1&&e.setRenderTarget(o),g=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return y},this.end=function(e,t){e.toneMapping=g,h=!0;let n=o,r=s;for(let i=0;i<v.length;i++){let a=v[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||m!==e.toneMapping){p=e.outputColorSpace,m=e.toneMapping,u.defines={},Ic.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=Ih[m];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(_),e.render(d,f),_=null,h=!1},this.isCompositing=function(){return h},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var Rh=new Kc,zh=new zd(1,1),Bh=new Xc,Vh=new Zc,Hh=new Ld,Uh=[],Wh=[],Gh=new Float32Array(16),Kh=new Float32Array(9),qh=new Float32Array(4);function Jh(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Uh[i];if(a===void 0&&(a=new Float32Array(i),Uh[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function Yh(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function Xh(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function Zh(e,t){let n=Wh[t];n===void 0&&(n=new Int32Array(t),Wh[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function Qh(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function $h(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Yh(n,t))return;e.uniform2fv(this.addr,t),Xh(n,t)}}function eg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(Yh(n,t))return;e.uniform3fv(this.addr,t),Xh(n,t)}}function tg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Yh(n,t))return;e.uniform4fv(this.addr,t),Xh(n,t)}}function ng(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Yh(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Xh(n,t)}else{if(Yh(n,r))return;qh.set(r),e.uniformMatrix2fv(this.addr,!1,qh),Xh(n,r)}}function rg(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Yh(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Xh(n,t)}else{if(Yh(n,r))return;Kh.set(r),e.uniformMatrix3fv(this.addr,!1,Kh),Xh(n,r)}}function ig(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Yh(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Xh(n,t)}else{if(Yh(n,r))return;Gh.set(r),e.uniformMatrix4fv(this.addr,!1,Gh),Xh(n,r)}}function ag(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function og(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Yh(n,t))return;e.uniform2iv(this.addr,t),Xh(n,t)}}function sg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Yh(n,t))return;e.uniform3iv(this.addr,t),Xh(n,t)}}function cg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Yh(n,t))return;e.uniform4iv(this.addr,t),Xh(n,t)}}function lg(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function ug(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Yh(n,t))return;e.uniform2uiv(this.addr,t),Xh(n,t)}}function dg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Yh(n,t))return;e.uniform3uiv(this.addr,t),Xh(n,t)}}function fg(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Yh(n,t))return;e.uniform4uiv(this.addr,t),Xh(n,t)}}function pg(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(zh.compareFunction=n.isReversedDepthBuffer()?518:515,a=zh):a=Rh,n.setTexture2D(t||a,i)}function mg(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||Vh,i)}function hg(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||Hh,i)}function gg(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Bh,i)}function _g(e){switch(e){case 5126:return Qh;case 35664:return $h;case 35665:return eg;case 35666:return tg;case 35674:return ng;case 35675:return rg;case 35676:return ig;case 5124:case 35670:return ag;case 35667:case 35671:return og;case 35668:case 35672:return sg;case 35669:case 35673:return cg;case 5125:return lg;case 36294:return ug;case 36295:return dg;case 36296:return fg;case 35678:case 36198:case 36298:case 36306:case 35682:return pg;case 35679:case 36299:case 36307:return mg;case 35680:case 36300:case 36308:case 36293:return hg;case 36289:case 36303:case 36311:case 36292:return gg}}function vg(e,t){e.uniform1fv(this.addr,t)}function yg(e,t){let n=Jh(t,this.size,2);e.uniform2fv(this.addr,n)}function bg(e,t){let n=Jh(t,this.size,3);e.uniform3fv(this.addr,n)}function xg(e,t){let n=Jh(t,this.size,4);e.uniform4fv(this.addr,n)}function Sg(e,t){let n=Jh(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Cg(e,t){let n=Jh(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function wg(e,t){let n=Jh(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function Tg(e,t){e.uniform1iv(this.addr,t)}function Eg(e,t){e.uniform2iv(this.addr,t)}function Dg(e,t){e.uniform3iv(this.addr,t)}function Og(e,t){e.uniform4iv(this.addr,t)}function kg(e,t){e.uniform1uiv(this.addr,t)}function Ag(e,t){e.uniform2uiv(this.addr,t)}function jg(e,t){e.uniform3uiv(this.addr,t)}function Mg(e,t){e.uniform4uiv(this.addr,t)}function Ng(e,t,n){let r=this.cache,i=t.length,a=Zh(n,i);Yh(r,a)||(e.uniform1iv(this.addr,a),Xh(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?zh:Rh;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Pg(e,t,n){let r=this.cache,i=t.length,a=Zh(n,i);Yh(r,a)||(e.uniform1iv(this.addr,a),Xh(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||Vh,a[e])}function Fg(e,t,n){let r=this.cache,i=t.length,a=Zh(n,i);Yh(r,a)||(e.uniform1iv(this.addr,a),Xh(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||Hh,a[e])}function Ig(e,t,n){let r=this.cache,i=t.length,a=Zh(n,i);Yh(r,a)||(e.uniform1iv(this.addr,a),Xh(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Bh,a[e])}function Lg(e){switch(e){case 5126:return vg;case 35664:return yg;case 35665:return bg;case 35666:return xg;case 35674:return Sg;case 35675:return Cg;case 35676:return wg;case 5124:case 35670:return Tg;case 35667:case 35671:return Eg;case 35668:case 35672:return Dg;case 35669:case 35673:return Og;case 5125:return kg;case 36294:return Ag;case 36295:return jg;case 36296:return Mg;case 35678:case 36198:case 36298:case 36306:case 35682:return Ng;case 35679:case 36299:case 36307:return Pg;case 35680:case 36300:case 36308:case 36293:return Fg;case 36289:case 36303:case 36311:case 36292:return Ig}}var Rg=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=_g(t.type)}},zg=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Lg(t.type)}},Bg=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},Vg=/(\w+)(\])?(\[|\.)?/g;function Hg(e,t){e.seq.push(t),e.map[t.id]=t}function Ug(e,t,n){let r=e.name,i=r.length;for(Vg.lastIndex=0;;){let a=Vg.exec(r),o=Vg.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Hg(n,l===void 0?new Rg(s,e,t):new zg(s,e,t));break}else{let e=n.map[s];e===void 0&&(e=new Bg(s),Hg(n,e)),n=e}}}var Wg=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Ug(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function Gg(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Kg=37297,qg=0;function Jg(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var Yg=new jc;function Xg(e){Ic._getMatrix(Yg,Ic.workingColorSpace,e);let t=`mat3( ${Yg.elements.map(e=>e.toFixed(4))} )`;switch(Ic.getTransfer(e)){case Ls:return[t,`LinearTransferOETF`];case Rs:return[t,`sRGBTransferOETF`];default:return U(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function Zg(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+Jg(e.getShaderSource(t),r)}else return i}function Qg(e,t){let n=Xg(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var $g={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function e_(e,t){let n=$g[t];return n===void 0?(U(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var t_=new K;function n_(){return Ic.getLuminanceCoefficients(t_),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${t_.x.toFixed(4)}, ${t_.y.toFixed(4)}, ${t_.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function r_(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(o_).join(`
`)}function i_(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function a_(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function o_(e){return e!==``}function s_(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function c_(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var l_=/^[ \t]*#include +<([\w\d./]+)>/gm;function u_(e){return e.replace(l_,f_)}var d_=new Map;function f_(e,t){let n=Zm[t];if(n===void 0){let e=d_.get(t);if(e!==void 0)n=Zm[e],U(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return u_(n)}var p_=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function m_(e){return e.replace(p_,h_)}function h_(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function g_(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var __={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function v_(e){return __[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var y_={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function b_(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:y_[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var x_={302:`ENVMAP_MODE_REFRACTION`};function S_(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:x_[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var C_={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function w_(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:C_[e.combine]||`ENVMAP_BLENDING_NONE`}function T_(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function E_(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=v_(n),l=b_(n),u=S_(n),d=w_(n),f=T_(n),p=r_(n),m=i_(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(o_).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(o_).join(`
`),_.length>0&&(_+=`
`)):(g=[g_(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(o_).join(`
`),_=[g_(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:Zm.tonemapping_pars_fragment,n.toneMapping===0?``:e_(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,Zm.colorspace_pars_fragment,Qg(`linearToOutputTexel`,n.outputColorSpace),n_(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(o_).join(`
`)),o=u_(o),o=s_(o,n),o=c_(o,n),s=u_(s),s=s_(s,n),s=c_(s,n),o=m_(o),s=m_(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=Gg(i,i.VERTEX_SHADER,y),S=Gg(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1)if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=Zg(i,x,`vertex`),n=Zg(i,S,`fragment`);W(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}else o===``?(s===``||c===``)&&(u=!1):U(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new Wg(i,h),T=a_(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,Kg)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=qg++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var D_=0,O_=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new k_(e),t.set(e,n)),n}},k_=class{constructor(e){this.id=D_++,this.code=e,this.usedTimes=0}};function A_(e){return e===1030||e===37490||e===36285}function j_(e,t,n,r,i,a){let o=new ll,s=new O_,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&U(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=Qm[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let j=e.getRenderTarget(),ee=e.state.buffers.depth.getReversed(),M=h.isInstancedMesh===!0,te=h.isBatchedMesh===!0,N=!!i.map,P=!!i.matcap,ne=!!x,re=!!i.aoMap,ie=!!i.lightMap,ae=!!i.bumpMap&&i.wireframe===!1,F=!!i.normalMap,oe=!!i.displacementMap,se=!!i.emissiveMap,I=!!i.metalnessMap,L=!!i.roughnessMap,ce=i.anisotropy>0,le=i.clearcoat>0,ue=i.dispersion>0,de=i.retroreflectivity>0,fe=i.iridescence>0,pe=i.sheen>0,me=i.transmission>0,he=ce&&!!i.anisotropyMap,ge=le&&!!i.clearcoatMap,_e=le&&!!i.clearcoatNormalMap,ve=le&&!!i.clearcoatRoughnessMap,ye=fe&&!!i.iridescenceMap,R=fe&&!!i.iridescenceThicknessMap,be=pe&&!!i.sheenColorMap,xe=pe&&!!i.sheenRoughnessMap,Se=!!i.specularMap,z=!!i.specularColorMap,Ce=!!i.specularIntensityMap,B=me&&!!i.transmissionMap,V=me&&!!i.thicknessMap,we=!!i.gradientMap,Te=!!i.alphaMap,Ee=i.alphaTest>0,De=!!i.alphaHash,Oe=!!i.extensions,ke=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(ke=e.toneMapping);let Ae={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:te,batchingColor:te&&h._colorsTexture!==null,instancing:M,instancingColor:M&&h.instanceColor!==null,instancingMorph:M&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Ic.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:N,matcap:P,envMap:ne,envMapMode:ne&&x.mapping,envMapCubeUVHeight:S,aoMap:re,lightMap:ie,bumpMap:ae,normalMap:F,displacementMap:oe,emissiveMap:se,normalMapObjectSpace:F&&i.normalMapType===1,normalMapTangentSpace:F&&i.normalMapType===0,packedNormalMap:F&&i.normalMapType===0&&A_(i.normalMap.format),metalnessMap:I,roughnessMap:L,anisotropy:ce,anisotropyMap:he,clearcoat:le,clearcoatMap:ge,clearcoatNormalMap:_e,clearcoatRoughnessMap:ve,dispersion:ue,retroreflection:de,iridescence:fe,iridescenceMap:ye,iridescenceThicknessMap:R,sheen:pe,sheenColorMap:be,sheenRoughnessMap:xe,specularMap:Se,specularColorMap:z,specularIntensityMap:Ce,transmission:me,transmissionMap:B,thicknessMap:V,gradientMap:we,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Te,alphaTest:Ee,alphaHash:De,combine:i.combine,mapUv:N&&m(i.map.channel),aoMapUv:re&&m(i.aoMap.channel),lightMapUv:ie&&m(i.lightMap.channel),bumpMapUv:ae&&m(i.bumpMap.channel),normalMapUv:F&&m(i.normalMap.channel),displacementMapUv:oe&&m(i.displacementMap.channel),emissiveMapUv:se&&m(i.emissiveMap.channel),metalnessMapUv:I&&m(i.metalnessMap.channel),roughnessMapUv:L&&m(i.roughnessMap.channel),anisotropyMapUv:he&&m(i.anisotropyMap.channel),clearcoatMapUv:ge&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:_e&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ve&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:ye&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:R&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:be&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:xe&&m(i.sheenRoughnessMap.channel),specularMapUv:Se&&m(i.specularMap.channel),specularColorMapUv:z&&m(i.specularColorMap.channel),specularIntensityMapUv:Ce&&m(i.specularIntensityMap.channel),transmissionMapUv:B&&m(i.transmissionMap.channel),thicknessMapUv:V&&m(i.thicknessMap.channel),alphaMapUv:Te&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(F||ce),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(N||Te),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&F===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:ee,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:ke,decodeVideoTexture:N&&i.map.isVideoTexture===!0&&Ic.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:se&&i.emissiveMap.isVideoTexture===!0&&Ic.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:Oe&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(Oe&&i.extensions.multiDraw===!0||te)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Ae.vertexUv1s=c.has(1),Ae.vertexUv2s=c.has(2),Ae.vertexUv3s=c.has(3),c.clear(),Ae}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=Qm[t];n=xp.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new E_(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function M_(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function N_(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function P_(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function F_(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||N_),r.length>1&&r.sort(t||P_),i.length>1&&i.sort(t||P_)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function I_(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new F_,e.set(t,[i])):n>=r.length?(i=new F_,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function L_(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new K,color:new q};break;case`SpotLight`:n={position:new K,direction:new K,color:new q,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new K,color:new q,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new K,skyColor:new q,groundColor:new q};break;case`RectAreaLight`:n={color:new q,position:new K,halfWidth:new K,halfHeight:new K};break}return e[t.id]=n,n}}}function R_(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new G};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new G};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new G,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var z_=0;function B_(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function V_(e){let t=new L_,n=R_(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new K);let i=new K,a=new Qc,o=new Qc;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(B_);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Q.LTC_FLOAT_1,r.rectAreaLTC2=Q.LTC_FLOAT_2):(r.rectAreaLTC1=Q.LTC_HALF_1,r.rectAreaLTC2=Q.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=z_++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function H_(e){let t=new V_(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function U_(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new H_(e),t.set(n,[a])):r>=i.length?(a=new H_(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var W_=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,G_=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,K_=[new K(1,0,0),new K(-1,0,0),new K(0,1,0),new K(0,-1,0),new K(0,0,1),new K(0,0,-1)],q_=[new K(0,-1,0),new K(0,-1,0),new K(0,0,1),new K(0,0,-1),new K(0,-1,0),new K(0,-1,0)],J_=new Qc,Y_=new K,X_=new K;function Z_(e,t,n){let r=new gd,i=new G,a=new G,o=new qc,s=new jp,c=new Mp,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new wp({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new G},radius:{value:4}},vertexShader:W_,fragmentShader:G_}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new Ou;m.setAttribute(`position`,new mu(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new Y(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(U(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){U(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){U(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new Yc(i.x,i.y,{format:Vo,type:Oo,minFilter:vo,magFilter:vo,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new zd(i.x,i.y,Do),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=Lo,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=ho,d.map.depthTexture.magFilter=ho}else l.isPointLight?(d.map=new Oh(i.x),d.map.depthTexture=new Bd(i.x,Eo)):(d.map=new Yc(i.x,i.y),d.map.depthTexture=new zd(i.x,i.y,Eo)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=Lo,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=vo,d.map.depthTexture.magFilter=vo):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=ho,d.map.depthTexture.magFilter=ho);d.camera.updateProjectionMatrix()}d.map.isWebGLCubeRenderTarget!==!0&&(d.map.width!==i.x||d.map.height!==i.y)&&d.map.setSize(i.x,i.y);let g=d.map.isWebGLCubeRenderTarget?6:d.getViewportCount();l.isPointLight!==!0&&d.updateMatrices(l,s);for(let t=0;t<g;t++){let i=d.getCamera(t);if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),Y_.setFromMatrixPosition(l.matrixWorld),e.position.copy(Y_),X_.copy(e.position),X_.add(K_[t]),e.up.copy(q_[t]),e.lookAt(X_),e.updateMatrixWorld(),n.makeTranslation(-Y_.x,-Y_.y,-Y_.z),J_.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(J_,e.coordinateSystem,e.reversedDepth)}if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}r=d.getFrustum(t),b(n,s,i,l,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null?n.mapPass=new Yc(i.x,i.y,{format:Vo,type:Oo}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value.set(n.map.width,n.map.height),f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value.set(n.map.width,n.map.height),p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||n.intersectsFrustum(r))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=y(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)b(c[e],i,a,o,s)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function Q_(e,t){function n(){let t=!1,n=new qc,r=null,i=new qc(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?I(e.DEPTH_TEST):L(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=$s[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?I(e.STENCIL_TEST):L(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new q(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ee=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),M=!1,te=0,N=e.getParameter(e.VERSION);N.indexOf(`WebGL`)===-1?N.indexOf(`OpenGL ES`)!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),M=te>=2):(te=parseFloat(/^WebGL (\d)/.exec(N)[1]),M=te>=1);let P=null,ne={},re=e.getParameter(e.SCISSOR_BOX),ie=e.getParameter(e.VIEWPORT),ae=new qc().fromArray(re),F=new qc().fromArray(ie);function oe(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let se={};se[e.TEXTURE_2D]=oe(e.TEXTURE_2D,e.TEXTURE_2D,1),se[e.TEXTURE_CUBE_MAP]=oe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[e.TEXTURE_2D_ARRAY]=oe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),se[e.TEXTURE_3D]=oe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),I(e.DEPTH_TEST),o.setFunc(3),he(!1),ge(1),I(e.CULL_FACE),pe(0);function I(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function L(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function ce(t,n){return f[t]===n?!1:(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function le(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function ue(t){return h===t?!1:(e.useProgram(t),h=t,!0)}let de={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};de[103]=e.MIN,de[104]=e.MAX;let fe={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function pe(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(L(e.BLEND),g=!1);return}if(g===!1&&(I(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:W(`WebGLState: Invalid blending: `,t);break}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:W(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:W(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:W(`WebGLState: Invalid blending: `,t);break}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(de[n],de[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(fe[r],fe[i],fe[o],fe[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function me(t,n){t.side===2?L(e.CULL_FACE):I(e.CULL_FACE);let r=t.side===1;n&&(r=!r),he(r),t.blending===1&&t.transparent===!1?pe(0):pe(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ve(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?I(e.SAMPLE_ALPHA_TO_COVERAGE):L(e.SAMPLE_ALPHA_TO_COVERAGE)}function he(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function ge(t){t===0?L(e.CULL_FACE):(I(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function _e(t){t!==k&&(M&&e.lineWidth(t),k=t)}function ve(t,n,r){t?(I(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):L(e.POLYGON_OFFSET_FILL)}function ye(t){t?I(e.SCISSOR_TEST):L(e.SCISSOR_TEST)}function R(t){t===void 0&&(t=e.TEXTURE0+ee-1),P!==t&&(e.activeTexture(t),P=t)}function be(t,n,r){r===void 0&&(r=P===null?e.TEXTURE0+ee-1:P);let i=ne[r];i===void 0&&(i={type:void 0,texture:void 0},ne[r]=i),(i.type!==t||i.texture!==n)&&(P!==r&&(e.activeTexture(r),P=r),e.bindTexture(t,n||se[t]),i.type=t,i.texture=n)}function xe(){let t=ne[P];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function Se(){try{e.compressedTexImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function z(){try{e.compressedTexImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Ce(){try{e.texSubImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function B(){try{e.texSubImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function V(){try{e.compressedTexSubImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function we(){try{e.compressedTexSubImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Te(){try{e.texStorage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Ee(){try{e.texStorage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function De(){try{e.texImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Oe(){try{e.texImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function ke(t){return d[t]===void 0?e.getParameter(t):d[t]}function Ae(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function je(t){ae.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ae.copy(t))}function Me(t){F.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),F.copy(t))}function Ne(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Pe(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Fe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},P=null,ne={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new q(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ae.set(0,0,e.canvas.width,e.canvas.height),F.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:I,disable:L,bindFramebuffer:ce,drawBuffers:le,useProgram:ue,setBlending:pe,setMaterial:me,setFlipSided:he,setCullFace:ge,setLineWidth:_e,setPolygonOffset:ve,setScissorTest:ye,activeTexture:R,bindTexture:be,unbindTexture:xe,compressedTexImage2D:Se,compressedTexImage3D:z,texImage2D:De,texImage3D:Oe,pixelStorei:Ae,getParameter:ke,updateUBOMapping:Ne,uniformBlockBinding:Pe,texStorage2D:Te,texStorage3D:Ee,texSubImage2D:Ce,texSubImage3D:B,compressedTexSubImage2D:V,compressedTexSubImage3D:we,scissor:je,viewport:Me,reset:Fe}}function $_(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new G,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function h(e,t){return m?new OffscreenCanvas(e,t):Gs(`canvas`)}function g(e,t,n){let r=1,i=Se(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1)if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=h(n,a));let o=t?h(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),U(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}else return`data`in e&&U(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e;return e}function _(e){return e.generateMipmaps}function v(t){e.generateMipmap(t)}function y(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function b(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];U(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||U(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?Ls:Ic.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function x(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,U(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function S(e,t){return _(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function C(e){let t=e.target;t.removeEventListener(`dispose`,C),T(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function w(e){let t=e.target;t.removeEventListener(`dispose`,w),D(t)}function T(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&E(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function E(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function D(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let O=0;function k(){O=0}function A(){return O}function j(e){O=e}function ee(){let e=O;return e>=i.maxTextures&&U(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),O+=1,e}function M(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function te(t,i){let a=r.get(t);if(t.isVideoTexture&&be(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)U(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)U(`WebGLRenderer: Texture marked for update but image is incomplete`);else{L(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function N(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){L(a,t,i);return}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i)}function P(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){L(a,t,i);return}n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function ne(t,i){let a=r.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version){ce(a,t,i);return}n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let re={[fo]:e.REPEAT,[po]:e.CLAMP_TO_EDGE,[mo]:e.MIRRORED_REPEAT},ie={[ho]:e.NEAREST,[go]:e.NEAREST_MIPMAP_NEAREST,[_o]:e.NEAREST_MIPMAP_LINEAR,[vo]:e.LINEAR,[yo]:e.LINEAR_MIPMAP_NEAREST,[bo]:e.LINEAR_MIPMAP_LINEAR},ae={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function F(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&U(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,re[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,re[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,re[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,ie[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,ie[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ae[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function oe(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,C));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=M(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&E(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function se(e,t,n){return Math.floor(Math.floor(e/n)/t)}function I(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=se(n.start,r.width,4),c=se(t.start,r.width,4);n.start<=i+1&&a===c&&se(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function L(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=oe(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Ic.getPrimaries(Ic.workingColorSpace),r=o.colorSpace===``?null:Ic.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=g(o.image,!1,i.maxTextureSize);t=xe(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=b(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);F(c,o);let h,y=o.mipmaps,C=o.isVideoTexture!==!0,w=f.__version===void 0||l===!0,T=u.dataReady,E=S(o,t);if(o.isDepthTexture)m=x(o.format===Ro,o.type),w&&(C?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture)if(y.length>0){C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else C?(w&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),T&&I(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data);else if(o.isCompressedTexture)if(o.isCompressedArrayTexture){C&&w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,y[0].width,y[0].height,t.depth);for(let i=0,a=y.length;i<a;i++)if(h=y[i],o.format!==1023)if(r!==null)if(C){if(T)if(o.layerUpdates.size>0){let t=qm(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0);else U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`);else C?T&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],o.format===1023?C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):C?T&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}else if(o.isDataArrayTexture)if(C){if(w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),T)if(o.layerUpdates.size>0){let i=qm(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isData3DTexture)C?(w&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),T&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(w)if(C)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(y.length>0){if(C&&w){let t=Se(y[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(C){if(w){let r=Se(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}T&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);_(o)&&v(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ce(t,o,s){if(o.image.length!==6)return;let c=oe(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Ic.getPrimaries(Ic.workingColorSpace),r=o.colorSpace===``?null:Ic.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=g(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=xe(o,m[e]);let h=m[0],y=a.convert(o.format,o.colorSpace),x=a.convert(o.type),C=b(o.internalFormat,y,x,o.normalized,o.colorSpace),w=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=S(o,h);F(e.TEXTURE_CUBE_MAP,o);let O;if(f){w&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,y,x,i.data):y===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,w&&T){O.length>0&&D++;let t=Se(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,t.width,t.height)}for(let t=0;t<6;t++)if(p){w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,y,x,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,m[t].width,m[t].height,0,y,x,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,i.width,i.height,0,y,x,i.data)}}else{w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,y,x,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,y,x,m[t]);for(let r=0;r<O.length;r++){let i=O[r];w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,y,x,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,y,x,i.image[t])}}}_(o)&&v(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function le(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=b(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),R(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,ye(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function ue(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=x(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;R(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ye(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,ye(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=b(o.internalFormat,c,l,o.normalized,o.colorSpace);R(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ye(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,ye(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function de(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,C)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),F(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else te(i.depthTexture,0);let u=l.__webglTexture,d=ye(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)R(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)R(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function fe(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer)if(a)for(let e=0;e<6;e++)de(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?de(i.__webglFramebuffer[0],t,0):de(i.__webglFramebuffer,t,0)}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),ue(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),ue(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function pe(t,n,i){let a=r.get(t);n!==void 0&&le(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&fe(t)}function me(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,w);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&R(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=b(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=ye(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),ue(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),F(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)le(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else le(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);_(i)&&v(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),F(c,a),le(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),_(a)&&v(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),F(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)le(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else le(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);_(i)&&v(r),n.unbindTexture()}t.depthBuffer&&fe(t)}function he(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(_(a)){let t=y(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),v(t),n.unbindTexture()}}}let ge=[],_e=[];function ve(t){if(t.samples>0){if(R(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(ge.length=0,_e.length=0,ge.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(ge.push(l),_e.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,_e)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,ge))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function ye(e){return Math.min(i.maxSamples,e.samples)}function R(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function be(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function xe(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Ic.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&U(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):W(`WebGLTextures: Unsupported texture color space:`,n)),t}function Se(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=ee,this.resetTextureUnits=k,this.getTextureUnits=A,this.setTextureUnits=j,this.setTexture2D=te,this.setTexture2DArray=N,this.setTexture3D=P,this.setTextureCube=ne,this.rebindTextures=pe,this.setupRenderTarget=me,this.updateRenderTargetMipmap=he,this.updateMultisampleRenderTarget=ve,this.setupDepthRenderbuffer=fe,this.setupFrameBufferTexture=le,this.useMultisampledRTT=R,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function ev(e,t){function n(n,r=``){let i,a=Ic.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779)if(a===`srgb`)if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===35840||n===35841||n===35842||n===35843)if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491)if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821)if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===36492||n===36494||n===36495)if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===36283||n===36284||n===36285||n===36286)if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var tv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,nv=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,rv=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Vd(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new wp({vertexShader:tv,fragmentShader:nv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Y(new up(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},iv=class extends ec{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new rv,g={},_=t.getContextAttributes(),v=null,y=null,b=[],x=[],S=new G,C=null,w=null,T=new pm;T.viewport=new qc;let E=new pm;E.viewport=new qc;let D=[T,E],O=new wm,k=null,A=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=b[e];return t===void 0&&(t=new Ol,b[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=b[e];return t===void 0&&(t=new Ol,b[e]=t),t.getGripSpace()},this.getHand=function(e){let t=b[e];return t===void 0&&(t=new Ol,b[e]=t),t.getHandSpace()};function j(e){let t=x.indexOf(e.inputSource);if(t===-1)return;let n=b[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ee(){r.removeEventListener(`select`,j),r.removeEventListener(`selectstart`,j),r.removeEventListener(`selectend`,j),r.removeEventListener(`squeeze`,j),r.removeEventListener(`squeezestart`,j),r.removeEventListener(`squeezeend`,j),r.removeEventListener(`end`,ee),r.removeEventListener(`inputsourceschange`,M);for(let e=0;e<b.length;e++){let t=x[e];t!==null&&(x[e]=null,b[e].disconnect(t))}k=null,A=null,h.reset();for(let e in g)delete g[e];if(e.setRenderTarget(v),f=null,d=null,u=null,r=null,y=null,F.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),w!==null){let e=w.camera;e.fov=w.fov,e.zoom=w.zoom,e.updateProjectionMatrix(),w=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(v=e.getRenderTarget(),r.addEventListener(`select`,j),r.addEventListener(`selectstart`,j),r.addEventListener(`selectend`,j),r.addEventListener(`squeeze`,j),r.addEventListener(`squeezestart`,j),r.addEventListener(`squeezeend`,j),r.addEventListener(`end`,ee),r.addEventListener(`inputsourceschange`,M),_.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;_.depth&&(o=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=_.stencil?Ro:Lo,a=_.stencil?jo:Eo);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new Yc(d.textureWidth,d.textureHeight,{format:Io,type:xo,depthTexture:new zd(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new Yc(f.framebufferWidth,f.framebufferHeight,{format:Io,type:xo,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),F.setContext(r),F.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function M(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=x.indexOf(n);r>=0&&(x[r]=null,b[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=x.indexOf(n);if(r===-1){for(let e=0;e<b.length;e++)if(e>=x.length){x.push(n),r=e;break}else if(x[e]===null){x[e]=n,r=e;break}if(r===-1)break}let i=b[r];i&&i.connect(n)}}let te=new K,N=new K;function P(e,t,n){te.setFromMatrixPosition(t.matrixWorld),N.setFromMatrixPosition(n.matrixWorld);let r=te.distanceTo(N),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function ne(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),O.near=E.near=T.near=t,O.far=E.far=T.far=n,(k!==O.near||A!==O.far)&&(r.updateRenderState({depthNear:O.near,depthFar:O.far}),k=O.near,A=O.far),O.layers.mask=e.layers.mask|6,T.layers.mask=O.layers.mask&-5,E.layers.mask=O.layers.mask&-3;let i=e.parent,a=O.cameras;ne(O,i);for(let e=0;e<a.length;e++)ne(a[e],i);a.length===2?P(O,T,E):O.projectionMatrix.copy(T.projectionMatrix),w===null&&e.isPerspectiveCamera&&(w={camera:e,fov:e.fov,zoom:e.zoom}),re(e,O,i)};function re(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=ic*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(!(d===null&&f===null))return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(O)},this.getCameraTexture=function(e){return g[e]};let ie=null;function ae(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let i=!1;t.length!==O.cameras.length&&(O.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(y,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(y))}let o=D[n];o===void 0&&(o=new pm,o.layers.enable(n),o.viewport=new qc,D[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(O.matrix.copy(o.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),i===!0&&O.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=g[n];e||(e=new Vd,g[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<b.length;e++){let t=x[e],n=b[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}ie&&ie(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let F=new Ym;F.setAnimationLoop(ae),this.setAnimationLoop=function(e){ie=e},this.dispose=function(){}}},av=new Qc,ov=new jc;ov.set(-1,0,0,0,1,0,0,0,1);function sv(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,bp(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(av.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(ov),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function cv(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return W(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return typeof i==`number`||typeof i==`boolean`?r[a]=i:ArrayBuffer.isView(i)?r[a]=i.slice():r[a]=i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?U(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):U(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var lv=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),uv=null;function dv(){return uv===null&&(uv=new rd(lv,16,16,Vo,Oo),uv.name=`DFG_LUT`,uv.minFilter=vo,uv.magFilter=vo,uv.wrapS=po,uv.wrapT=po,uv.generateMipmaps=!1,uv.needsUpdate=!0),uv}var fv=class{constructor(e={}){let{canvas:t=Ks(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=xo}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([Uo,Ho,Bo]),g=new Set([xo,Eo,wo,jo,ko,Ao]),_=new Uint32Array(4),v=new Int32Array(4),y=new K,b=null,x=null,S=[],C=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,E=!1,D=null,O=null,k=null,A=null;this._outputColorSpace=Fs;let j=0,ee=0,M=null,te=-1,N=null,P=new qc,ne=new qc,re=null,ie=new q(0),ae=0,F=t.width,oe=t.height,se=1,I=null,L=null,ce=new qc(0,0,F,oe),le=new qc(0,0,F,oe),ue=!1,de=new gd,fe=!1,pe=!1,me=new Qc,he=new K,ge=new qc,_e={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ve=!1;function ye(){return M===null?se:1}let R=n;function be(e,n){return t.getContext(e,n)}let xe,Se,z,Ce,B,V,we,Te,Ee,De,Oe,ke,Ae,je,Me,Ne,Pe,Fe,Ie,Le,Re,ze,Be;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,Ue,!1),t.addEventListener(`webglcontextrestored`,We,!1),t.addEventListener(`webglcontextcreationerror`,Ge,!1),R===null){let t=`webgl2`;if(R=be(t,e),R===null)throw be(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}Ve()}catch(e){throw t.removeEventListener(`webglcontextlost`,Ue,!1),t.removeEventListener(`webglcontextrestored`,We,!1),t.removeEventListener(`webglcontextcreationerror`,Ge,!1),W(`WebGLRenderer: `+e.message),e}function Ve(){xe=new Ah(R),xe.init(),Re=new ev(R,xe),Se=new ah(R,xe,e,Re),z=new Q_(R,xe),Se.reversedDepthBuffer&&d&&z.buffers.depth.setReversed(!0),O=R.createFramebuffer(),k=R.createFramebuffer(),A=R.createFramebuffer(),Ce=new Nh(R),B=new M_,V=new $_(R,xe,z,B,Se,Re,Ce),we=new kh(T),Te=new Xm(R),ze=new rh(R,Te),Ee=new jh(R,Te,Ce,ze),De=new Fh(R,Ee,Te,ze,Ce),Fe=new Ph(R,Se,V),Me=new oh(B),Oe=new j_(T,we,xe,Se,ze,Me),ke=new sv(T,B),Ae=new I_,je=new U_(xe),Pe=new nh(T,we,z,De,p,s),Ne=new Z_(T,De,Se),Be=new cv(R,Ce,Se,z),Ie=new ih(R,xe,Ce),Le=new Mh(R,xe,Ce),Ce.programs=Oe.programs,T.capabilities=Se,T.extensions=xe,T.properties=B,T.renderLists=Ae,T.shadowMap=Ne,T.state=z,T.info=Ce}m!==1009&&(w=new Lh(m,t.width,t.height,o,r,i));let He=new iv(T,R);this.xr=He,this.getContext=function(){return R},this.getContextAttributes=function(){return R.getContextAttributes()},this.forceContextLoss=function(){let e=xe.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=xe.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return se},this.setPixelRatio=function(e){e!==void 0&&(se=e,this.setSize(F,oe,!1))},this.getSize=function(e){return e.set(F,oe)},this.setSize=function(e,n,r=!0){if(He.isPresenting){U(`WebGLRenderer: Can't change size while VR device is presenting.`);return}F=e,oe=n,t.width=Math.floor(e*se),t.height=Math.floor(n*se),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(F*se,oe*se).floor()},this.setDrawingBufferSize=function(e,n,r){F=e,oe=n,se=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009){W(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){U(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}w.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(P)},this.getViewport=function(e){return e.copy(ce)},this.setViewport=function(e,t,n,r){e.isVector4?ce.set(e.x,e.y,e.z,e.w):ce.set(e,t,n,r),z.viewport(P.copy(ce).multiplyScalar(se).round())},this.getScissor=function(e){return e.copy(le)},this.setScissor=function(e,t,n,r){e.isVector4?le.set(e.x,e.y,e.z,e.w):le.set(e,t,n,r),z.scissor(ne.copy(le).multiplyScalar(se).round())},this.getScissorTest=function(){return ue},this.setScissorTest=function(e){z.setScissorTest(ue=e)},this.setOpaqueSort=function(e){I=e},this.setTransparentSort=function(e){L=e},this.getClearColor=function(e){return e.copy(Pe.getClearColor())},this.setClearColor=function(){Pe.setClearColor(...arguments)},this.getClearAlpha=function(){return Pe.getClearAlpha()},this.setClearAlpha=function(){Pe.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(M!==null){let t=M.texture.format;e=h.has(t)}if(e){let e=M.texture.type,t=g.has(e),n=Pe.getClearColor(),r=Pe.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(_[0]=i,_[1]=a,_[2]=o,_[3]=r,R.clearBufferuiv(R.COLOR,0,_)):(v[0]=i,v[1]=a,v[2]=o,v[3]=r,R.clearBufferiv(R.COLOR,0,v))}else r|=R.COLOR_BUFFER_BIT}t&&(r|=R.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=R.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&R.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),D=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,Ue,!1),t.removeEventListener(`webglcontextrestored`,We,!1),t.removeEventListener(`webglcontextcreationerror`,Ge,!1),Pe.dispose(),Ae.dispose(),je.dispose(),B.dispose(),we.dispose(),De.dispose(),ze.dispose(),Be.dispose(),Oe.dispose(),He.dispose(),He.removeEventListener(`sessionstart`,Ze),He.removeEventListener(`sessionend`,Qe),$e.stop()};function Ue(e){e.preventDefault(),Ys(`WebGLRenderer: Context Lost.`),E=!0}function We(){Ys(`WebGLRenderer: Context Restored.`),E=!1;let e=Ce.autoReset,t=Ne.enabled,n=Ne.autoUpdate,r=Ne.needsUpdate,i=Ne.type;Ve(),Ce.autoReset=e,Ne.enabled=t,Ne.autoUpdate=n,Ne.needsUpdate=r,Ne.type=i}function Ge(e){W(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function H(e){let t=e.target;t.removeEventListener(`dispose`,H),Ke(t)}function Ke(e){qe(e),B.remove(e)}function qe(e){let t=B.get(e).programs;t!==void 0&&(t.forEach(function(e){Oe.releaseProgram(e)}),e.isShaderMaterial&&Oe.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=_e);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=lt(e,t,n,r,i);z.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Ee.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;ze.setup(i,r,s,n,c);let h,g=Ie;if(c!==null&&(h=Te.get(c),g=Le,g.setIndex(h)),i.isMesh)r.wireframe===!0?(z.setLineWidth(r.wireframeLinewidth*ye()),g.setMode(R.LINES)):g.setMode(R.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),z.setLineWidth(e*ye()),i.isLineSegments?g.setMode(R.LINES):i.isLineLoop?g.setMode(R.LINE_LOOP):g.setMode(R.LINE_STRIP)}else i.isPoints?g.setMode(R.POINTS):i.isSprite&&g.setMode(R.TRIANGLES);if(i.isBatchedMesh)if(xe.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?Te.get(c).bytesPerElement:1,o=B.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(R,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function Je(e,t,n,r){D!==null&&e.isNodeMaterial&&D.setObject(r,e),fe===!0&&Me.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,at(e,t,r),e.side=0,e.needsUpdate=!0,at(e,t,r),e.side=2):at(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),D!==null&&D.renderStart(e,t,n),x=je.get(n),x.init(t),C.push(x),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),x.setupLights(),D!==null&&D.updateLights(x.state.lightsArray),pe=this.localClippingEnabled,fe=Me.init(this.clippingPlanes,pe),fe===!0&&Me.setGlobalState(this.clippingPlanes,t),D!==null&&Ne.render(x.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i)if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];Je(o,n,t,e),r.add(o)}else Je(i,n,t,e),r.add(i)}),x=C.pop(),D!==null&&D.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){let t=B.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}xe.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let Ye=null;function Xe(e){Ye&&Ye(e)}function Ze(){$e.stop()}function Qe(){$e.start()}let $e=new Ym;$e.setAnimationLoop(Xe),typeof self<`u`&&$e.setContext(self),this.setAnimationLoop=function(e){Ye=e,He.setAnimationLoop(e),e===null?$e.stop():$e.start()},He.addEventListener(`sessionstart`,Ze),He.addEventListener(`sessionend`,Qe),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){W(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(E===!0)return;D!==null&&D.renderStart(e,t);let n=He.enabled===!0&&He.isPresenting===!0,r=w!==null&&(M===null||n)&&w.begin(T,M);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),He.enabled===!0&&He.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(He.cameraAutoUpdate===!0&&He.updateCamera(t),t=He.getCamera()),e.isScene===!0&&e.onBeforeRender(T,e,t,M),x=je.get(e,C.length),x.init(t),x.state.textureUnits=V.getTextureUnits(),C.push(x),me.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),de.setFromProjectionMatrix(me,Hs,t.reversedDepth),pe=this.localClippingEnabled,fe=Me.init(this.clippingPlanes,pe),b=Ae.get(e,S.length),b.init(),S.push(b),He.enabled===!0&&He.isPresenting===!0){let e=T.xr.getDepthSensingMesh();e!==null&&et(e,t,-1/0,T.sortObjects)}et(e,t,0,T.sortObjects),b.finish(),D!==null&&D.updateLights(x.state.lightsArray),T.sortObjects===!0&&b.sort(I,L),ve=He.enabled===!1||He.isPresenting===!1||He.hasDepthSensing()===!1,ve&&Pe.addToRenderList(b,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),fe===!0&&Me.beginShadows();let i=x.state.shadowsArray;if(Ne.render(i,e,t),fe===!0&&Me.endShadows(),(r&&w.hasRenderPass())===!1){let n=b.opaque,r=b.transmissive;if(x.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];nt(n,r,e,a)}ve&&Pe.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];tt(b,e,n,n.viewport)}}else r.length>0&&nt(n,r,e,t),ve&&Pe.render(e),tt(b,e,t)}M!==null&&ee===0&&(V.updateMultisampleRenderTarget(M),V.updateRenderTargetMipmap(M)),r&&w.end(T),e.isScene===!0&&e.onAfterRender(T,e,t),ze.resetDefaultState(),te=-1,N=null,C.pop(),C.length>0?(x=C[C.length-1],V.setTextureUnits(x.state.textureUnits),fe===!0&&Me.setGlobalState(T.clippingPlanes,x.state.camera)):x=null,S.pop(),b=S.length>0?S[S.length-1]:null,D!==null&&D.renderEnd()};function et(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)x.pushLightProbeGrid(e);else if(e.isLight)x.pushLight(e),e.castShadow&&x.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(de)){r&&ge.setFromMatrixPosition(e.matrixWorld).applyMatrix4(me);let i=De.update(e),a=e.material;a.visible&&b.push(e,i,a,n,ge.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(de))){let i=De.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),ge.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),ge.copy(e.boundingSphere.center)),ge.applyMatrix4(e.matrixWorld).applyMatrix4(me)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&b.push(e,i,c,n,ge.z,s,t)}}else a.visible&&b.push(e,i,a,n,ge.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)et(i[e],t,n,r)}function tt(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;x.setupLightsView(n),fe===!0&&Me.setGlobalState(T.clippingPlanes,n),r&&z.viewport(P.copy(r)),i.length>0&&rt(i,t,n),a.length>0&&rt(a,t,n),o.length>0&&rt(o,t,n),z.buffers.depth.setTest(!0),z.buffers.depth.setMask(!0),z.buffers.color.setMask(!0),z.setPolygonOffset(!1)}function nt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[r.id]===void 0){let e=xe.has(`EXT_color_buffer_half_float`)||xe.has(`EXT_color_buffer_float`);x.state.transmissionRenderTarget[r.id]=new Yc(1,1,{generateMipmaps:!0,type:e?Oo:xo,minFilter:bo,samples:Math.max(4,Se.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ic.workingColorSpace})}let a=x.state.transmissionRenderTarget[r.id],o=r.viewport||P;a.setSize(o.z*T.transmissionResolutionScale,o.w*T.transmissionResolutionScale);let s=T.getRenderTarget(),c=T.getActiveCubeFace(),l=T.getActiveMipmapLevel();T.setRenderTarget(a),T.getClearColor(ie),ae=T.getClearAlpha(),ae<1&&T.setClearColor(16777215,.5),T.clear(),ve&&Pe.render(n);let u=T.toneMapping;T.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),x.setupLightsView(r),fe===!0&&Me.setGlobalState(T.clippingPlanes,r),rt(e,n,r),V.updateMultisampleRenderTarget(a),V.updateRenderTargetMipmap(a),xe.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,it(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(V.updateMultisampleRenderTarget(a),V.updateRenderTargetMipmap(a))}T.setRenderTarget(s,c,l),T.setClearColor(ie,ae),d!==void 0&&(r.viewport=d),T.toneMapping=u}function rt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&it(o,t,n,s,l,c)}}function it(e,t,n,r,i,a){D!==null&&i.isNodeMaterial&&D.setObject(e,i),e.onBeforeRender(T,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(T,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=2):T.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(T,t,n,r,i,a)}function at(e,t,n){t.isScene!==!0&&(t=_e);let r=B.get(e),i=x.state.lights,a=x.state.shadowsArray,o=i.state.version,s=Oe.getParameters(e,i.state,a,t,n,x.state.lightProbeGridArray),c=Oe.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=we.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,H),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return st(e,s),d}else s.uniforms=Oe.getUniforms(e),D!==null&&e.isNodeMaterial&&D.build(e,n,s),e.onBeforeCompile(s,T),d=Oe.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Me.uniform),st(e,s),r.needsLights=dt(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=x.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function ot(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=Wg.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function st(e,t){let n=B.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function ct(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];y.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(y))return n}return null}function lt(e,t,n,r,i){t.isScene!==!0&&(t=_e),V.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=M===null?T.outputColorSpace:M.isXRRenderTarget===!0?M.texture.colorSpace:Ic.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=we.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(M===null||M.isXRRenderTarget===!0)&&(h=T.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=B.get(r),y=x.state.lights;if(fe===!0&&(pe===!0||e!==N)){let t=e===N&&r.id===te;Me.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Me.numPlanes||v.numIntersection!==Me.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=x.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let S=v.currentProgram;b===!0&&(S=at(r,t,i),D&&r.isNodeMaterial&&D.onUpdateProgram(r,S,v));let C=!1,w=!1,E=!1,O=S.getUniforms(),k=v.uniforms;if(z.useProgram(S.program)&&(C=!0,w=!0,E=!0),r.id!==te&&(te=r.id,w=!0),v.needsLights){let e=ct(x.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,w=!0)}if(C||N!==e){z.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),O.setValue(R,`projectionMatrix`,e.projectionMatrix),O.setValue(R,`viewMatrix`,e.matrixWorldInverse);let t=O.map.cameraPosition;t!==void 0&&t.setValue(R,he.setFromMatrixPosition(e.matrixWorld)),Se.logarithmicDepthBuffer&&O.setValue(R,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&O.setValue(R,`isOrthographic`,e.isOrthographicCamera===!0),N!==e&&(N=e,w=!0,E=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&O.setValue(R,`sunShadowMap`,y.state.sunShadowMap,V),y.state.directionalShadowMap.length>0&&O.setValue(R,`directionalShadowMap`,y.state.directionalShadowMap,V),y.state.spotShadowMap.length>0&&O.setValue(R,`spotShadowMap`,y.state.spotShadowMap,V),y.state.pointShadowMap.length>0&&O.setValue(R,`pointShadowMap`,y.state.pointShadowMap,V)),i.isSkinnedMesh){O.setOptional(R,i,`bindMatrix`),O.setOptional(R,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),O.setValue(R,`boneTexture`,e.boneTexture,V))}i.isBatchedMesh&&(O.setOptional(R,i,`batchingTexture`),O.setValue(R,`batchingTexture`,i._matricesTexture,V),O.setOptional(R,i,`batchingIdTexture`),O.setValue(R,`batchingIdTexture`,i._indirectTexture,V),O.setOptional(R,i,`batchingColorTexture`),i._colorsTexture!==null&&O.setValue(R,`batchingColorTexture`,i._colorsTexture,V));let A=n.morphAttributes;if((A.position!==void 0||A.normal!==void 0||A.color!==void 0)&&Fe.update(i,n,S),(w||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,O.setValue(R,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(k.envMapIntensity.value=t.environmentIntensity),k.dfgLUT!==void 0&&(k.dfgLUT.value=dv()),w){if(O.setValue(R,`toneMappingExposure`,T.toneMappingExposure),v.needsLights&&ut(k,E),a&&r.fog===!0&&ke.refreshFogUniforms(k,a),ke.refreshMaterialUniforms(k,r,se,oe,x.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;k.probesSH.value=e.texture,k.probesMin.value.copy(e.boundingBox.min),k.probesMax.value.copy(e.boundingBox.max),k.probesResolution.value.copy(e.resolution)}Wg.upload(R,ot(v),k,V)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(Wg.upload(R,ot(v),k,V),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&O.setValue(R,`center`,i.center),O.setValue(R,`modelViewMatrix`,i.modelViewMatrix),O.setValue(R,`normalMatrix`,i.normalMatrix),O.setValue(R,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Be.update(n,S),Be.bind(n,S)}}return S}function ut(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function dt(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return ee},this.getRenderTarget=function(){return M},this.setRenderTargetTextures=function(e,t,n){let r=B.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),B.get(e.texture).__webglTexture=t,B.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=B.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){M=e,j=t,ee=n;let r=null,i=!1,a=!1;if(e){let o=B.get(e);if(o.__useDefaultFramebuffer!==void 0){z.bindFramebuffer(R.FRAMEBUFFER,o.__webglFramebuffer),P.copy(e.viewport),ne.copy(e.scissor),re=e.scissorTest,z.viewport(P),z.scissor(ne),z.setScissorTest(re),te=-1;return}else if(o.__webglFramebuffer===void 0)V.setupRenderTarget(e);else if(o.__hasExternalTextures)V.rebindTextures(e,B.get(e.texture).__webglTexture,B.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&B.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);V.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=B.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&V.useMultisampledRTT(e)===!1?B.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,P.copy(e.viewport),ne.copy(e.scissor),re=e.scissorTest}else P.copy(ce).multiplyScalar(se).floor(),ne.copy(le).multiplyScalar(se).floor(),re=ue;if(n!==0&&(r=O),z.bindFramebuffer(R.FRAMEBUFFER,r)&&z.drawBuffers(e,r),z.viewport(P),z.scissor(ne),z.setScissorTest(re),i){let r=B.get(e.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=B.get(e.textures[t]);R.framebufferTextureLayer(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=B.get(e.texture);R.framebufferTexture2D(R.FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,t.__webglTexture,n)}te=-1};function ft(e){let t=B.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=Se.textureFormatReadable(e.format),t.__typeReadable=Se.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=B.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){z.bindFramebuffer(R.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&R.readBuffer(R.COLOR_ATTACHMENT0+s);let u=ft(o);if(u.__formatReadable===!1){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&R.readPixels(t,n,r,i,Re.convert(c),Re.convert(l),a)}finally{let e=M===null?null:B.get(M).__webglFramebuffer;z.bindFramebuffer(R.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=B.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c)if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){z.bindFramebuffer(R.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&R.readBuffer(R.COLOR_ATTACHMENT0+s);let d=ft(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=R.createBuffer();R.bindBuffer(R.PIXEL_PACK_BUFFER,f),R.bufferData(R.PIXEL_PACK_BUFFER,a.byteLength,R.STREAM_READ),R.readPixels(t,n,r,i,Re.convert(l),Re.convert(u),0),R.bindBuffer(R.PIXEL_PACK_BUFFER,null);let p=M===null?null:B.get(M).__webglFramebuffer;z.bindFramebuffer(R.FRAMEBUFFER,p);let m=R.fenceSync(R.SYNC_GPU_COMMANDS_COMPLETE,0);return R.flush(),await Qs(R,m,4),R.bindBuffer(R.PIXEL_PACK_BUFFER,f),R.getBufferSubData(R.PIXEL_PACK_BUFFER,0,a),R.bindBuffer(R.PIXEL_PACK_BUFFER,null),R.deleteBuffer(f),R.deleteSync(m),a}else throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;V.setTexture2D(e,0),R.copyTexSubImage2D(R.TEXTURE_2D,n,0,0,o,s,i,a),z.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=Re.convert(t.format),_=Re.convert(t.type),v;t.isData3DTexture?(V.setTexture3D(t,0),v=R.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(V.setTexture2DArray(t,0),v=R.TEXTURE_2D_ARRAY):(V.setTexture2D(t,0),v=R.TEXTURE_2D),z.activeTexture(R.TEXTURE0),z.pixelStorei(R.UNPACK_FLIP_Y_WEBGL,t.flipY),z.pixelStorei(R.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),z.pixelStorei(R.UNPACK_ALIGNMENT,t.unpackAlignment);let y=z.getParameter(R.UNPACK_ROW_LENGTH),b=z.getParameter(R.UNPACK_IMAGE_HEIGHT),x=z.getParameter(R.UNPACK_SKIP_PIXELS),S=z.getParameter(R.UNPACK_SKIP_ROWS),C=z.getParameter(R.UNPACK_SKIP_IMAGES);z.pixelStorei(R.UNPACK_ROW_LENGTH,h.width),z.pixelStorei(R.UNPACK_IMAGE_HEIGHT,h.height),z.pixelStorei(R.UNPACK_SKIP_PIXELS,l),z.pixelStorei(R.UNPACK_SKIP_ROWS,u),z.pixelStorei(R.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=B.get(e),r=B.get(t),h=B.get(n.__renderTarget),g=B.get(r.__renderTarget);z.bindFramebuffer(R.READ_FRAMEBUFFER,h.__webglFramebuffer),z.bindFramebuffer(R.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(R.framebufferTextureLayer(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,B.get(e).__webglTexture,i,d+n),R.framebufferTextureLayer(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,B.get(t).__webglTexture,a,m+n)),R.blitFramebuffer(l,u,o,s,f,p,o,s,R.DEPTH_BUFFER_BIT,R.NEAREST);z.bindFramebuffer(R.READ_FRAMEBUFFER,null),z.bindFramebuffer(R.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||B.has(e)){let n=B.get(e),r=B.get(t);z.bindFramebuffer(R.READ_FRAMEBUFFER,k),z.bindFramebuffer(R.DRAW_FRAMEBUFFER,A);for(let e=0;e<c;e++)w?R.framebufferTextureLayer(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):R.framebufferTexture2D(R.READ_FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,n.__webglTexture,i),T?R.framebufferTextureLayer(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):R.framebufferTexture2D(R.DRAW_FRAMEBUFFER,R.COLOR_ATTACHMENT0,R.TEXTURE_2D,r.__webglTexture,a),i===0?T?R.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):R.copyTexSubImage2D(v,a,f,p,l,u,o,s):R.blitFramebuffer(l,u,o,s,f,p,o,s,R.COLOR_BUFFER_BIT,R.NEAREST);z.bindFramebuffer(R.READ_FRAMEBUFFER,null),z.bindFramebuffer(R.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?R.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?R.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):R.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?R.texSubImage2D(R.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?R.compressedTexSubImage2D(R.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):R.texSubImage2D(R.TEXTURE_2D,a,f,p,o,s,g,_,h);z.pixelStorei(R.UNPACK_ROW_LENGTH,y),z.pixelStorei(R.UNPACK_IMAGE_HEIGHT,b),z.pixelStorei(R.UNPACK_SKIP_PIXELS,x),z.pixelStorei(R.UNPACK_SKIP_ROWS,S),z.pixelStorei(R.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&R.generateMipmap(v),z.unbindTexture()},this.initRenderTarget=function(e){B.get(e).__webglFramebuffer===void 0&&V.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?V.setTextureCube(e,0):e.isData3DTexture?V.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?V.setTexture2DArray(e,0):V.setTexture2D(e,0),z.unbindTexture()},this.resetState=function(){j=0,ee=0,M=null,z.reset(),ze.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return Hs}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ic._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ic._getUnpackColorSpace()}},pv=1500,mv=8e5,hv=.08,gv=.25,_v=1e4*io.SCALE,vv=2.5;500/(vv*60);var yv=.03,bv=io.THEME,xv={uCameraPosXZ:{value:new G(0,0)},uRenderRadius:{value:co.RENDER_DISTANCE*pv},uSunDirection:{value:new K(0,1,0)},uTopColor:{value:new q},uBottomColor:{value:new q}};function $(e){let t={...e},n;switch(bv){case`toon`:delete t.roughness,delete t.metalness,delete t.envMap,delete t.envMapIntensity,n=new Op(t);break;case`basic`:delete t.roughness,delete t.metalness,n=new Uu(t);break;case`phong`:delete t.roughness,delete t.metalness,t.shininess=60,n=new Dp(t);break;case`lambert`:delete t.roughness,delete t.metalness,n=new Ap(t);break;case`normal`:n=new kp({flatShading:e.flatShading});break;case`wireframe`:t.wireframe=!0,n=new Uu(t);break;default:n=new Ep(t);break}return n.onBeforeCompile=e=>{e.uniforms.uCameraPosXZ=xv.uCameraPosXZ,e.uniforms.uRenderRadius=xv.uRenderRadius,e.uniforms.uSunDirection=xv.uSunDirection,e.uniforms.uTopColor=xv.uTopColor,e.uniforms.uBottomColor=xv.uBottomColor,e.vertexShader=`
      uniform vec2 uCameraPosXZ;
      uniform float uRenderRadius;
      varying float vDistanceXZ;
      varying vec3 vWorldPosition;
    `+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <worldpos_vertex>`,`#include <worldpos_vertex>
       vec4 customWorldPosition = vec4( transformed, 1.0 );
       #ifdef USE_INSTANCING
         customWorldPosition = instanceMatrix * customWorldPosition;
       #endif
       customWorldPosition = modelMatrix * customWorldPosition;
       #ifdef USE_FOG
         vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);
         vWorldPosition = customWorldPosition.xyz;
       #endif`),e.fragmentShader=`
      uniform vec3 uSunDirection;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uRenderRadius;
      varying float vDistanceXZ;
      varying vec3 vWorldPosition;
    `+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,`#ifdef USE_FOG
         vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
         vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
         float hFog = skyDir.y;
         float baseSunInt = max(0.0, dot(skyDir, uSunDirection));
         float sunFade = smoothstep(-0.25, 0.0, uSunDirection.y);
         float g = pow(baseSunInt * sunFade, 2.0);
         vec3 effBottom = uBottomColor;
         vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
         if (hFog < 0.0) fogSkyColor = effBottom;
         
         float sunElev = uSunDirection.y;
         float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);
         vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(hFog, 0.0));
         vec3 ambientSunGlow = wideGlow * sunFade;
         float haloFade = smoothstep(-0.03, 0.06, sunElev);
         vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8 * haloFade;
         vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
         float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
         vec3 hotCore = coreColor * pow(baseSunInt, 512.0) * coreStrength;
         vec3 totalGlow = (ambientSunGlow + warmHalo + hotCore) * smoothstep(-0.12, 0.04, hFog);
         fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
         
         #ifdef FOG_EXP2
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
         #else
             float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
         #endif
         
         float finalFogFactor = fogFactor;
         if (uRenderRadius > 0.0) {
             float distRatio = vDistanceXZ / uRenderRadius;
             float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
             finalFogFactor = max(fogFactor, xzFogFactor);
         }
         
         gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
       #endif`)},n}var Sv=new Map;function Cv(e){let t=Sv.get(e);return t||(t=document.getElementById(e),t&&Sv.set(e,t)),t}function wv(e,t){let n=typeof e==`string`?Cv(e):e;if(!n)return;let r=String(t);n.textContent!==r&&(n.textContent=r)}function Tv(e={},t=[]){try{let n=Cv(`debug-menu`);if(!(n&&n.style.display===`block`))return;let r=new URL(window.location.href);!t.includes(`debug`)&&!r.searchParams.has(`debug`)&&r.searchParams.set(`debug`,`true`),t.forEach(e=>r.searchParams.delete(e)),Object.entries(e).forEach(([e,t])=>{t==null?r.searchParams.delete(e):r.searchParams.set(e,t)}),window.history.replaceState(null,``,r.toString())}catch(e){console.error(`Failed to update URL parameters:`,e)}}var Ev=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]),Dv=function(){for(var e=.5*(Math.sqrt(3)-1),t=(3-Math.sqrt(3))/6,n=new Uint8Array(256),r=io.mulberry32(io.WORLD_SEED),i=0;i<256;i++)n[i]=Math.floor(r()*256);var a=new Uint8Array(512),o=new Uint8Array(512);for(i=0;i<512;i++)a[i]=n[i&255],o[i]=a[i]%12;return{seed:function(e){r=io.mulberry32(e);for(var t=0;t<256;t++)n[t]=Math.floor(r()*256);for(t=0;t<512;t++)a[t]=n[t&255],o[t]=a[t]%12},noise2D:function(n,r){var i,s,c,l=(n+r)*e,u=Math.floor(n+l),d=Math.floor(r+l),f=(u+d)*t,p=u-f,m=d-f,h=n-p,g=r-m,_,v;h>g?(_=1,v=0):(_=0,v=1);var y=h-_+t,b=g-v+t,x=h-1+2*t,S=g-1+2*t,C=u&255,w=d&255,T=o[C+a[w]]*3,E=o[C+_+a[w+v]]*3,D=o[C+1+a[w+1]]*3,O=.5-h*h-g*g;O<0?i=0:(O*=O,i=O*O*(Ev[T]*h+Ev[T+1]*g));var k=.5-y*y-b*b;k<0?s=0:(k*=k,s=k*k*(Ev[E]*y+Ev[E+1]*b));var A=.5-x*x-S*S;return A<0?c=0:(A*=A,c=A*A*(Ev[D]*x+Ev[D+1]*S)),70*(i+s+c)},noise3D:function(e,t,n){var r,i,s,c,l=(e+t+n)*(1/3),u=Math.floor(e+l),d=Math.floor(t+l),f=Math.floor(n+l),p=1/6,m=(u+d+f)*p,h=u-m,g=d-m,_=f-m,v=e-h,y=t-g,b=n-_,x,S,C,w,T,E;v>=y?y>=b?(x=1,S=0,C=0,w=1,T=1,E=0):v>=b?(x=1,S=0,C=0,w=1,T=0,E=1):(x=0,S=0,C=1,w=1,T=0,E=1):y<b?(x=0,S=0,C=1,w=0,T=1,E=1):v<b?(x=0,S=1,C=0,w=0,T=1,E=1):(x=0,S=1,C=0,w=1,T=1,E=0);var D=v-x+p,O=y-S+p,k=b-C+p,A=v-w+2*p,j=y-T+2*p,ee=b-E+2*p,M=v-1+3*p,te=y-1+3*p,N=b-1+3*p,P=u&255,ne=d&255,re=f&255,ie=o[P+a[ne+a[re]]]*3,ae=o[P+x+a[ne+S+a[re+C]]]*3,F=o[P+w+a[ne+T+a[re+E]]]*3,oe=o[P+1+a[ne+1+a[re+1]]]*3,se=.6-v*v-y*y-b*b;se<0?r=0:(se*=se,r=se*se*(Ev[ie]*v+Ev[ie+1]*y+Ev[ie+2]*b));var I=.6-D*D-O*O-k*k;I<0?i=0:(I*=I,i=I*I*(Ev[ae]*D+Ev[ae+1]*O+Ev[ae+2]*k));var L=.6-A*A-j*j-ee*ee;L<0?s=0:(L*=L,s=L*L*(Ev[F]*A+Ev[F+1]*j+Ev[F+2]*ee));var ce=.6-M*M-te*te-N*N;return ce<0?c=0:(ce*=ce,c=ce*ce*(Ev[oe]*M+Ev[oe+1]*te+Ev[oe+2]*N)),32*(r+i+s+c)}}}();io.setRoadNoise(Dv);var Ov=new Fl;Ov.fog=new Pl(10541295,15e-5);function kv(e={}){let t=new El,n=e=>typeof $==`function`?$(e):new Ep(e),r=e.planeColor===void 0?co.planeColor===void 0?4691163:co.planeColor:e.planeColor,i=r===15254402?1847620:16777215,a=e.planeMat||n({color:r,flatShading:!0,roughness:.5}),o=e.planeWhiteMat||n({color:i,flatShading:!0,roughness:.5}),s=n({color:2829099,flatShading:!0,roughness:.6}),c=n({color:1710618,flatShading:!0,roughness:.8}),l=n({color:988970,roughness:.1,transparent:!0,opacity:.8});a.userData={type:`accent`},o.userData={type:`body`};let u=new Z(.7,1.8,12.5,8);u.rotateX(Math.PI/2);let d=new Y(u,o);d.position.set(0,0,-1.2),d.scale.set(1.05,1.28,1),t.add(d);let f=new Z(1.8,1.35,2.6,8);f.rotateX(Math.PI/2);let p=new Y(f,o);p.position.set(0,0,-8.7),p.scale.set(1.05,1.28,1),t.add(p);let m=new Z(1.3,1.3,.3,8);m.rotateX(Math.PI/2);let h=new Y(m,c);h.position.set(0,0,-10.05),h.scale.set(1.02,1.25,1),t.add(h);let g=new Hd(.65,1.6,8);g.rotateX(-Math.PI/2);let _=new Y(g,a);_.position.set(0,-.1,-10.9),t.add(_);let v=new El;v.position.set(0,-.1,-10.3),t.add(v),t.propGroup=v;let y=new Y(new X(8.6,.7,.12),c);v.add(y);let b=new Y(new X(2.18,.35,10.5),a);b.position.set(0,.15,-1.8),t.add(b);let x=new Y(new X(1.9,.25,2.8),c);x.position.set(0,1.48,-3.2),t.add(x);let S=new Y(new X(1.5,1.2,2.4),c);S.position.set(0,.9,-3.2),t.add(S);let C=new Y(new X(.7,.5,.35),c);C.position.set(0,1.65,-1.95),t.add(C);let w=new Y(new X(1.7,.85,.12),l);w.position.set(0,1.85,-4.7),w.rotation.x=Math.PI/6,t.add(w);let T=(e,t,n,r)=>{let i=new Sf,a=t/2,o=Math.min(r||e*.75,a*.65);i.moveTo(0,-a),i.quadraticCurveTo(e,-a,e,-a+o),i.quadraticCurveTo(e*1.04,0,e,a-o),i.quadraticCurveTo(e,a,0,a),i.lineTo(0,-a);let s=new op(i,{depth:n,bevelEnabled:!1,curveSegments:8});return s.translate(0,0,-n/2),s.rotateX(Math.PI/2),s},E=2.85,D=.42,O=4.4,k=new X(10.5,D,O),A=new Y(k,o);A.position.set(-7.75,E,-4),t.add(A);let j=new Y(k,o);j.position.set(7.75,E,-4),t.add(j);let ee=new Y(new X(5,D,2.2),o);ee.position.set(0,E,-5.1),t.add(ee);let M=T(1.5,O,D,1.1),te=new Y(M,a);te.position.set(13,E,-4),t.add(te);let N=new Y(M,a);N.position.set(-13,E,-4),N.rotation.y=Math.PI,t.add(N);let P=-.7,ne=.42,re=3.9,ie=new Y(new X(18,ne,re),o);ie.position.set(0,P,-3),t.add(ie);let ae=T(1.3,re,ne,1),F=new Y(ae,a);F.position.set(9,P,-3),t.add(F);let oe=new Y(ae,a);oe.position.set(-9,P,-3),oe.rotation.y=Math.PI,t.add(oe);let se=e=>{let t=new El,n=.1,r=e*8.6,i=new K(r,P,-4.4),a=new K(r,E,-5.6),o=new Y(new Z(n,n,i.distanceTo(a),6),s),l=new K().addVectors(i,a).multiplyScalar(.5);o.position.copy(l),o.quaternion.setFromUnitVectors(new K(0,1,0),new K().subVectors(a,i).normalize()),t.add(o);let u=new K(r,P,-1.6),d=new K(r,E,-2.4),f=new Y(new Z(n,n,u.distanceTo(d),6),s),p=new K().addVectors(u,d).multiplyScalar(.5);f.position.copy(p),f.quaternion.setFromUnitVectors(new K(0,1,0),new K().subVectors(d,u).normalize()),t.add(f);let m=new K(r,P,-1.6),h=new K(r,E,-5.6),g=m.distanceTo(h),_=new Y(new Z(n*.9,n*.9,g,6),s),v=new K().addVectors(m,h).multiplyScalar(.5);_.position.copy(v),_.quaternion.setFromUnitVectors(new K(0,1,0),new K().subVectors(h,m).normalize()),t.add(_);let y=new K(r*.98,P,-4.4),b=new K(r*.98,E,-2.4),x=new Y(new Z(.04,.04,y.distanceTo(b),4),c),S=new K().addVectors(y,b).multiplyScalar(.5);return x.position.copy(S),x.quaternion.setFromUnitVectors(new K(0,1,0),new K().subVectors(b,y).normalize()),t.add(x),t};t.add(se(-1)),t.add(se(1));let I=(e,t)=>{let n=new Y(new Z(.1,.1,e.distanceTo(t),6),s),r=new K().addVectors(e,t).multiplyScalar(.5);return n.position.copy(r),n.quaternion.setFromUnitVectors(new K(0,1,0),new K().subVectors(t,e).normalize()),n};t.add(I(new K(-1.3,1.3,-5.2),new K(-2.2,E,-4.8))),t.add(I(new K(1.3,1.3,-5.2),new K(2.2,E,-4.8))),t.add(I(new K(-1.3,1.4,-2.8),new K(-2.2,E,-3.2))),t.add(I(new K(1.3,1.4,-2.8),new K(2.2,E,-3.2)));let L=e=>{let t=new El,n=e*3.8,r=-3.2,i=-4.6,s=new K(e*1.2,-.8,-4.6),l=new K(n,r+.5,i),u=I(s,l);t.add(u);let d=new Y(new X(.28,2,.7),o),f=new K().addVectors(s,l).multiplyScalar(.5);d.position.copy(f),d.rotation.z=e*-.42,t.add(d);let p=new El;p.position.set(n,r,i);let m=new Y(new X(.8,1.3,2.6),o);p.add(m);let h=new Hd(.65,1.1,8);h.rotateX(-Math.PI/2);let g=new Y(h,o);g.position.set(0,0,-1.8),g.scale.set(.65,1,1),p.add(g);let _=new Hd(.65,1.8,8);_.rotateX(Math.PI/2);let v=new Y(_,o);v.position.set(0,0,2.1),v.scale.set(.65,1,1),p.add(v);let y=new Y(new X(.85,.28,2.2),a);y.position.set(0,.1,0),p.add(y);let b=new Z(.6,.6,.45,10);b.rotateZ(Math.PI/2);let x=new Y(b,c);return x.position.set(0,-.45,0),p.add(x),t.add(p),t};t.add(L(-1)),t.add(L(1));let ce=new Y(new X(.2,.6,1),s);ce.position.set(0,-.65,4.8),ce.rotation.x=-.3,t.add(ce);let le=new Z(.25,.25,.2,8);le.rotateZ(Math.PI/2);let ue=new Y(le,c);ue.position.set(0,-.9,5.2),t.add(ue);let de=2.8,fe=.35,pe=6.4,me=new Y(new X(pe,fe,de),o);me.position.set(0,.55,5.2),t.add(me);let he=T(1,de,fe,.75),ge=new Y(he,a);ge.position.set(pe/2,.55,5.2),t.add(ge);let _e=new Y(he,a);_e.position.set(-pe/2,.55,5.2),_e.rotation.y=Math.PI,t.add(_e);let ve=new Sf;ve.moveTo(0,0),ve.lineTo(2.8,0),ve.quadraticCurveTo(2.6,2,2.2,3.4),ve.quadraticCurveTo(1.3,4.4,.2,3.7),ve.quadraticCurveTo(.02,1.8,0,0);let ye=new op(ve,{depth:.35,bevelEnabled:!1,curveSegments:8});ye.translate(-1.4,0,-.175),ye.rotateY(Math.PI/-2);let R=new Y(ye,a);return R.position.set(0,.8,5),t.add(R),t.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=!0)}),t}function Av(e={}){let t=new El,n=e=>typeof $==`function`?$(e):new Ep(e),r=e.planeColor===void 0?co.planeColor===void 0?14702156:co.planeColor:e.planeColor,i=r===15254402?1847620:16317180,a=e.planeMat||n({color:r,flatShading:!0,roughness:.35}),o=e.planeWhiteMat||n({color:i,flatShading:!0,roughness:.35}),s=n({color:1976635,flatShading:!0,roughness:.2,metalness:.1}),c=n({color:988970,flatShading:!0,roughness:.8});a.userData={type:`accent`},o.userData={type:`body`};let l=new El;l.position.set(0,.15,-6.6),t.add(l),t.propGroup=l;let u=new Z(.7,.25,1.6,32);u.rotateX(Math.PI/2);let d=new Y(u,a);d.position.set(0,0,-.8),d.scale.set(1.1,1.3,1),l.add(d);let f=new Y(new mp(.25,16,16),a);f.position.set(0,0,-1.6),f.scale.set(1.1,1.3,1),l.add(f);let p=new Z(1.1,.7,2.4,32);p.rotateX(Math.PI/2);let m=new Y(p,o);m.position.set(0,.15,-5.4),m.scale.set(1.1,1.3,1),t.add(m);let h=new Z(1,1.1,2.8,32);h.rotateX(Math.PI/2);let g=new Y(h,o);g.position.set(0,.18,-2.8),g.scale.set(1.1,1.3,1),t.add(g);let _=new Z(.55,1,2.2,32);_.rotateX(Math.PI/2);let v=new Y(_,o);v.position.set(0,.24,-.3),v.scale.set(1.05,1.25,1),t.add(v);let y=new Z(.25,.55,7.8,32);y.rotateX(Math.PI/2);let b=new Y(y,o);b.position.set(0,.3,4.7),b.scale.set(1,1.15,1),t.add(b);let x=new Z(1.102,.702,2.4,32,1,!1,Math.PI/2+.5,.5);x.rotateX(Math.PI/2);let S=new Y(x,a);S.position.set(0,.15,-5.4),S.scale.set(1.1,1.3,1),t.add(S);let C=new Z(1.102,.702,2.4,32,1,!1,-Math.PI/2-1,.5);C.rotateX(Math.PI/2);let w=new Y(C,a);w.position.set(0,.15,-5.4),w.scale.set(1.1,1.3,1),t.add(w);let T=new Z(1.002,1.102,2.8,32,1,!1,Math.PI/2+.5,.5);T.rotateX(Math.PI/2);let E=new Y(T,a);E.position.set(0,.18,-2.8),E.scale.set(1.1,1.3,1),t.add(E);let D=new Z(1.002,1.102,2.8,32,1,!1,-Math.PI/2-1,.5);D.rotateX(Math.PI/2);let O=new Y(D,a);O.position.set(0,.18,-2.8),O.scale.set(1.1,1.3,1),t.add(O);let k=new Y(new mp(1,32,24),s);k.position.set(0,.65,-4.4),k.scale.set(1.02,.95,2.1),t.add(k);let A=14.8,j=2.1,ee=.76,M=.2,te=.052,N=((e,t,n,r)=>{let i=new Sf,a=t/2,o=n/2,s=.22;i.moveTo(0,-a),i.lineTo(e,-o-s),i.lineTo(e,o-s),i.lineTo(0,a),i.lineTo(0,-a);let c=new op(i,{depth:r,bevelEnabled:!1});return c.translate(0,0,-r/2),c.rotateX(-Math.PI/2),c})(A,j,ee,M),P=new Y(new X(1.6,M+.04,j),o);P.position.set(0,.6,-1),t.add(P);let ne=new El;ne.position.set(.8,.6,-1),ne.rotation.z=te,t.add(ne);let re=new Y(N,o);ne.add(re);let ie=new X(A*.95,.02,.04),ae=new Y(ie,c);ae.position.set(A*.5,M/2+.01,.35),ae.rotation.y=.035,ne.add(ae);let F=new El;F.position.set(-.8,.6,-1),F.rotation.z=-te,t.add(F);let oe=new Y(N,o);oe.scale.set(-1,1,1),F.add(oe);let se=new Y(ie,c);se.position.set(-A*.5,M/2+.01,.35),se.rotation.y=-.035,F.add(se);let I=1.9,L=ee,ce=ee*.4,le=.38,ue=new Sf;ue.moveTo(-L/2,0),ue.lineTo(L/2,0),ue.quadraticCurveTo(ce/2+le*.6,I*.6,ce/2+le,I),ue.lineTo(-ce/2+le,I),ue.quadraticCurveTo(-L/2+le*.3,I*.45,-L/2,0);let de=new op(ue,{depth:.12,bevelEnabled:!1});de.translate(0,0,-.06),de.rotateY(-Math.PI/2);let fe=new Y(de,a);fe.position.set(A,.02,.22),fe.rotation.z=-.16,ne.add(fe);let pe=new Y(de,a);pe.position.set(-A,.02,.22),pe.rotation.z=.16,F.add(pe);let me=3.6,he=2.2,ge=1.3,_e=.92,ve=new Sf;ve.moveTo(-he/2,0),ve.lineTo(-he/2+.8,0),ve.lineTo(-ge/2+.5+_e,me),ve.lineTo(-ge/2+_e,me),ve.lineTo(-he/2,0);let ye=new op(ve,{depth:.2,bevelEnabled:!1});ye.translate(0,0,-.1),ye.rotateY(-Math.PI/2);let R=new Y(ye,o);R.position.set(0,.36,7.5),t.add(R);let be=new Sf;be.moveTo(-he/2+.8,.05),be.lineTo(he/2,.05),be.lineTo(ge/2+_e,me),be.lineTo(-ge/2+.5+_e,me),be.lineTo(-he/2+.8,.05);let xe=new op(be,{depth:.16,bevelEnabled:!1});xe.translate(0,0,-.08),xe.rotateY(-Math.PI/2);let Se=new Y(xe,a);Se.position.set(0,.36,7.5),t.add(Se);let z=3.8,Ce=1.25,B=.75,V=.15,we=new Sf;we.moveTo(-z,-B/2+.1),we.lineTo(0,-Ce/2),we.lineTo(z,-B/2+.1),we.lineTo(z,B/2),we.lineTo(0,Ce/2),we.lineTo(-z,B/2),we.lineTo(-z,-B/2+.1);let Te=new op(we,{depth:V,bevelEnabled:!1});Te.translate(0,0,-V/2),Te.rotateX(-Math.PI/2);let Ee=new Y(Te,o);Ee.position.set(0,.36+me,7.5+_e),t.add(Ee);let De=new Z(.16,.12,1.5,8);De.rotateX(Math.PI/2);let Oe=new Y(De,o);Oe.position.set(0,.36+me+.08,7.5+_e),t.add(Oe);let ke=new Z(.5,.5,.28,8);ke.rotateZ(Math.PI/2);let Ae=new Y(ke,c);return Ae.position.set(0,-.6,-2.4),t.add(Ae),t.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=!0)}),t}function jv(e={}){let t=new El,n=e=>typeof $==`function`?$(e):new Ep(e),r=e.planeColor===void 0?co.planeColor===void 0?14702156:co.planeColor:e.planeColor,i=r===15254402?1847620:16317180,a=e.planeMat||n({color:r,flatShading:!0,roughness:.35}),o=e.planeWhiteMat||n({color:i,flatShading:!0,roughness:.35}),s=n({color:1976635,flatShading:!0,roughness:.7}),c=n({color:988970,flatShading:!0,roughness:.15,metalness:.2}),l=n({color:6583435,flatShading:!0,roughness:.4,metalness:.3}),u=n({color:1120295,flatShading:!0,roughness:.9});a.userData={type:`accent`},o.userData={type:`body`};let d=new El;t.add(d);let f=[{z:-10.8,y:-.06,rx:.38,ry:.38},{z:-9.5,y:.02,rx:1.05,ry:.98},{z:-7.8,y:.1,rx:1.45,ry:1.38},{z:-6.2,y:.2,rx:1.62,ry:1.7},{z:-2.5,y:.2,rx:1.64,ry:1.72},{z:3.5,y:.2,rx:1.64,ry:1.72},{z:7.2,y:.24,rx:1.35,ry:1.45},{z:9.8,y:.28,rx:.82,ry:.92},{z:11.8,y:.32,rx:.42,ry:.48},{z:13,y:.34,rx:.08,ry:.08}],p=[],m=[],h=[];for(let e=0;e<f.length;e++){let t=f[e];for(let n=0;n<16;n++){let r=n/16*Math.PI*2,i=t.rx*Math.cos(r),a=t.y+t.ry*Math.sin(r),o=t.z;p.push(i,a,o),m.push(n/16,e/(f.length-1))}}for(let e=0;e<f.length-1;e++)for(let t=0;t<16;t++){let n=(t+1)%16,r=e*16+t,i=e*16+n,a=(e+1)*16+t,o=(e+1)*16+n;h.push(r,i,a),h.push(i,o,a)}let g=p.length/3;p.push(0,f[0].y,f[0].z),m.push(.5,0);for(let e=0;e<16;e++){let t=(e+1)%16;h.push(g,t,e)}let _=(f.length-1)*16,v=p.length/3;p.push(0,f[f.length-1].y,f[f.length-1].z),m.push(.5,1);for(let e=0;e<16;e++){let t=(e+1)%16;h.push(v,_+e,_+t)}let y=new Ou;y.setAttribute(`position`,new J(p,3)),y.setAttribute(`uv`,new J(m,2)),y.setIndex(h),y.computeVertexNormals();let b=new Y(y,o);d.add(b);let x=new Y(new mp(.42,12,8),a);x.position.set(0,-.06,-10.8),x.scale.set(.95,.95,1.1),d.add(x);let S=new Z(1.42,.44,2.9,16,1,!1,0,Math.PI);S.rotateX(Math.PI/2),S.rotateZ(Math.PI/2);let C=new Y(S,a);C.position.set(0,-.01,-9.4),C.scale.set(.98,.96,1),d.add(C);let w=new Y(new mp(1,24,18),c);w.position.set(0,.78,-7.5),w.scale.set(1.08,.62,2.05),w.rotation.x=.12,d.add(w);let T=.26,E=-6.5,D=3.1,O=3.8,k=new Sf;k.moveTo(E,-T),k.lineTo(D,-T),k.lineTo(O,0),k.lineTo(D,T),k.lineTo(E,T),k.closePath();let A=new Y(new fp(k),a);A.position.set(-1.65,.26,0),A.rotation.y=-Math.PI/2,d.add(A);let j=new Sf;j.moveTo(-O,0),j.lineTo(-D,-T),j.lineTo(-E,-T),j.lineTo(-E,T),j.lineTo(-D,T),j.closePath();let ee=new Y(new fp(j),a);ee.position.set(1.65,.26,0),ee.rotation.y=Math.PI/2,d.add(ee);let M=new Z(1.42,1.42,.48,16,1,!0,0,Math.PI);M.rotateX(Math.PI/2),M.rotateZ(Math.PI/2);let te=new Y(M,a);te.position.set(0,.12,-7.8),te.scale.set(.98,.96,1),d.add(te);let N=new X(.1,.32,.56);for(let e=0;e<7;e++){let t=-4.2+e*1.1,n=new Y(N,c);n.position.set(-1.66,.26,t),d.add(n);let r=new Y(N,c);r.position.set(1.66,.26,t),d.add(r)}let P=new El;P.position.set(0,-.65,-.6),t.add(P);let ne=new Y(new X(11.6,.52,4.6),o);ne.position.set(0,0,0),P.add(ne);let re=new Z(1.68,1.68,4.6,12,1,!1,0,Math.PI);re.rotateX(Math.PI/2),re.rotateZ(Math.PI/2);let ie=new Y(re,o);ie.position.set(0,.5,0),ie.scale.set(.96,.45,1),P.add(ie);let ae=10.5,F=.08,oe=2.3,se=-2.3,I=1.9,L=I-2.1,ce={depth:.44,bevelEnabled:!1,curveSegments:6},le=e=>{let t=new Sf,n=.65;e?(t.moveTo(0,se),t.lineTo(ae-n,L),t.quadraticCurveTo(ae,L,ae,L+n),t.lineTo(ae,I-n),t.quadraticCurveTo(ae,I,ae-n,I),t.lineTo(0,oe)):(t.moveTo(0,oe),t.lineTo(-ae+n,I),t.quadraticCurveTo(-ae,I,-ae,I-n),t.lineTo(-ae,L+n),t.quadraticCurveTo(-ae,L,-ae+n,L),t.lineTo(0,se)),t.closePath();let r=new op(t,ce);r.rotateX(Math.PI/2),r.translate(0,-.22,0);let i=new El;i.position.set(e?5.8:-5.8,.02,0),i.rotation.z=e?F:-F;let a=new Y(r,o);return i.add(a),i},ue=le(!0);P.add(ue);let de=le(!1);P.add(de);let fe=[],pe=e=>{let t=new El,n=e?1:-1;t.position.set(n*5.8,-.62,-1.6);let r=new Z(1.08,.94,5.4,14);r.rotateX(Math.PI/2);let i=new Y(r,o);i.position.set(0,0,.2),i.scale.set(1,1.15,1),t.add(i);let c=new Hd(.94,2.6,14);c.rotateX(Math.PI/2);let d=new Y(c,o);d.position.set(0,0,4.2),d.scale.set(1,1.14,1),t.add(d);let f=new Z(1.12,1.14,1.6,14);f.rotateX(Math.PI/2);let p=new Y(f,a);p.position.set(0,0,-2.8),p.scale.set(1,1.14,1),t.add(p);let m=new Y(new hp(.98,.14,8,14),a);m.position.set(0,0,-3.6),m.scale.set(1,1.12,1),t.add(m);let h=new Z(.94,.94,.25,14);h.rotateX(Math.PI/2);let g=new Y(h,s);g.position.set(0,0,-3.3),t.add(g);let _=new Z(.32,.32,.4,8);_.rotateX(Math.PI/2);let v=new Y(_,l);v.position.set(0,0,-3.5),t.add(v);let y=new El;y.position.set(0,0,-3.75),t.add(y),fe.push(y);let b=new Hd(.34,1,10);b.rotateX(-Math.PI/2);let x=new Y(b,a);x.position.set(0,0,-.48),y.add(x);let S=new Z(.34,.34,.12,10);S.rotateX(Math.PI/2);let C=new Y(S,l);C.position.set(0,0,.02),y.add(C);let w=new X(.24,2.3,.06);w.translate(0,1.15,0);for(let e=0;e<3;e++){let t=new El;t.rotation.z=e*Math.PI*2/3;let n=new Y(w,s);n.rotation.y=.22,t.add(n);let r=new X(.25,.32,.07);r.translate(0,2.15,0);let i=new Y(r,a);i.rotation.y=.22,t.add(i),y.add(t)}let T=new El;T.position.set(0,-.7,.2),t.add(T);let E=new Z(.08,.08,1.6,6),D=new Y(E,l);D.position.set(-.25,-.6,0),D.rotation.z=-.06,T.add(D);let O=new Y(E,l);O.position.set(.25,-.6,0),O.rotation.z=.06,T.add(O);let k=new Z(.06,.06,.75,6);k.rotateZ(Math.PI/2);let A=new Y(k,l);A.position.set(0,-1.35,0),T.add(A);let j=new Z(.62,.62,.36,12);j.rotateZ(Math.PI/2);let ee=new Y(j,u);ee.position.set(0,-1.35,0),T.add(ee);let M=new Z(.26,.26,.38,8);M.rotateZ(Math.PI/2);let te=new Y(M,l);return te.position.set(0,-1.35,0),T.add(te),t},me=pe(!1);t.add(me);let he=pe(!0);t.add(he),t.propGroups=fe,t.propGroup=fe[0]||null;let ge=new El;ge.position.set(0,-.9,-7.8),t.add(ge);let _e=new Y(new Z(.09,.08,1.5,6),l);_e.position.set(0,-.55,0),_e.rotation.x=-.15,ge.add(_e);let ve=new Z(.46,.46,.28,12);ve.rotateZ(Math.PI/2);let ye=new Y(ve,u);ye.position.set(0,-1.3,.12),ge.add(ye);let R=new Z(.2,.2,.3,8);R.rotateZ(Math.PI/2);let be=new Y(R,l);be.position.set(0,-1.3,.12),ge.add(be);let xe=new El;t.add(xe);let Se=new Sf;Se.moveTo(4,.8),Se.quadraticCurveTo(6.8,1.3,8.4,2.6),Se.lineTo(9.2,4.6),Se.quadraticCurveTo(10.2,4.8,10.8,4.3),Se.quadraticCurveTo(11.8,3.2,12,1.2),Se.lineTo(12,.8),Se.lineTo(4,.8),Se.closePath();let z=new op(Se,{depth:.28,bevelEnabled:!1});z.rotateY(-Math.PI/2),z.translate(.14,0,0);let Ce=new Y(z,a);xe.add(Ce);let B=2.8,V=1.4,we=.26,Te=new Sf,Ee=12.6/2,De=.45;Te.moveTo(0,-B*.45),Te.lineTo(Ee-De,-V*.4),Te.quadraticCurveTo(Ee,-V*.4,Ee,-V*.4+De),Te.lineTo(Ee,V*.6-De),Te.quadraticCurveTo(Ee,V*.6,Ee-De,V*.6),Te.lineTo(0,B*.55),Te.lineTo(-Ee+De,V*.6),Te.quadraticCurveTo(-Ee,V*.6,-Ee,V*.6-De),Te.lineTo(-Ee,-V*.4+De),Te.quadraticCurveTo(-Ee,-V*.4,-Ee+De,-V*.4),Te.closePath();let Oe=new op(Te,{depth:we,bevelEnabled:!1,curveSegments:6});Oe.rotateX(Math.PI/2),Oe.translate(0,-we/2,0);let ke=new Y(Oe,a);return ke.position.set(0,.75,10.2),xe.add(ke),t.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=!0)}),t}var Mv=new El;Mv.rotation.y=0,Ov.add(Mv),Mv.rotation.order=`YXZ`;var Nv=$({color:co.planeColor===15254402?1847620:16777215,flatShading:!0}),Pv=$({color:co.planeColor,flatShading:!0}),Fv=new El;Fv.visible=!1;var Iv=$({color:13421772,flatShading:!0}),Lv=new Z(1,1,15,8);Lv.rotateX(Math.PI/2);var Rv=new Hd(1,3,8);Rv.rotateX(-Math.PI/2);var zv=new Y(Rv,Iv);zv.position.set(0,0,-9);var Bv=new El,Vv=new Y(Lv,Iv);Vv.scale.set(1,.7,1),zv.scale.set(1,.7,1),Bv.add(Vv),Bv.add(zv),Bv.position.set(-5,-4.5,0);var Hv=new Z(.1,.1,5,6),Uv=new Y(Hv,Iv);Uv.position.set(2.5,2,-3),Uv.rotation.z=-Math.PI/4,Bv.add(Uv);var Wv=new Y(Hv,Iv);Wv.position.set(2.5,2,3),Wv.rotation.z=-Math.PI/4,Bv.add(Wv),Fv.add(Bv);var Gv=zv.clone(),Kv=new El,qv=new Y(Lv,Iv);qv.scale.set(1,.7,1),Gv.scale.set(1,.7,1),Kv.add(qv),Kv.add(Gv),Kv.position.set(5,-4.5,0);var Jv=new Y(Hv,Iv);Jv.position.set(-2.5,2,-3),Jv.rotation.z=Math.PI/4,Kv.add(Jv);var Yv=new Y(Hv,Iv);Yv.position.set(-2.5,2,3),Yv.rotation.z=Math.PI/4,Kv.add(Yv),Fv.add(Kv);var Xv=new El;Xv.position.set(-5,0,-3),Fv.add(Xv);var Zv=new El;Zv.position.set(-5,0,3),Fv.add(Zv);var Qv=new El;Qv.position.set(5,0,-3),Fv.add(Qv);var $v=new El;$v.position.set(5,0,3),Fv.add($v);function ey(e={}){let t=new El,n=e.planeWhiteMat||Nv,r=e.planeMat||Pv,i=new Z(.7,1.8,14,8);i.rotateX(Math.PI/2);let a=new Y(i,n);a.position.set(0,0,-2),a.scale.set(1,1.3,1),t.add(a);let o=new Z(1.8,1,2.5,8);o.rotateX(Math.PI/2);let s=new Y(o,n);s.position.set(0,0,-10.25),s.scale.set(1,1.3,1),t.add(s);let c=new Y(new X(2.6,2,4),n);c.position.set(0,1.5,-3.5),t.add(c);let l=$({color:1118481,roughness:.1}),u=new Y(new X(2.65,1.8,1.5),l);u.position.set(0,1.8,-5.5),u.rotation.x=Math.PI/5.5,t.add(u);let d=new Y(new X(2.7,1,2),l);d.position.set(0,1.7,-3.5),t.add(d);let f=new Y(new X(3,.4,13),r);f.position.set(0,.2,-2),t.add(f);let p=new Y(new X(28,.5,4.5),n);p.position.set(0,2.8,-3.5),t.add(p);let m=new X(2,.5,4.5),h=new Y(m,r);h.position.set(-15,2.8,-3.5),t.add(h);let g=new Y(m,r);g.position.set(15,2.8,-3.5),t.add(g);let _=new Z(.15,.15,7.5,6),v=new Y(_,n);v.position.set(-4.5,1.65,-3.5),v.rotation.z=Math.PI*.4,t.add(v);let y=new Y(_,n);y.position.set(4.5,1.65,-3.5),y.rotation.z=-Math.PI*.4,t.add(y);let b=new Y(new X(8,.4,3),n);b.position.set(0,.5,5.5),t.add(b);let x=new X(1,.4,3),S=new Y(x,r);S.position.set(-4.5,.5,5.5),t.add(S);let C=new Y(x,r);C.position.set(4.5,.5,5.5),t.add(C);let w=new Sf;w.moveTo(0,0),w.lineTo(3,0),w.lineTo(2.5,4),w.lineTo(1,4),w.lineTo(0,0);let T=new op(w,{depth:.3,bevelEnabled:!1});T.translate(-1.5,0,-.15),T.rotateY(Math.PI/-2);let E=new Y(T,r);E.position.set(0,.7,5.5),t.add(E);let D=new El;D.position.set(0,-.2,-11.6),t.add(D);let O=new Z(.5,.5,1,8);O.rotateX(Math.PI/2);let k=new Y(O,$({color:3355443}));D.add(k);let A=new X(9,.6,.1),j=$({color:2236962}),ee=new Y(A,j),M=new Y(A,j);return M.rotation.z=Math.PI/2,D.add(ee),D.add(M),t.propGroup=D,t.add(Fv),t.pontoonGroup=Fv,t}var ty=io.START_PLANE||localStorage.getItem(`chill_flight_plane`)||`classic`;function ny(){return(ty===`glider`?300:500)/(vv*60)}function ry(e,t=!1){if(![`classic`,`biplane`,`glider`,`twin`].includes(e))return;if(ty=e,!t)try{localStorage.setItem(`chill_flight_plane`,e)}catch{}co.targetFlightSpeed!==void 0&&typeof ny==`function`&&(co.targetFlightSpeed=Math.min(co.targetFlightSpeed,ny())),co.airplaneModel&&Mv&&Mv.remove(co.airplaneModel);let n;n=e===`biplane`&&typeof kv==`function`?kv({planeColor:co.planeColor===void 0?16777215:co.planeColor,planeMat:Pv,planeWhiteMat:Nv}):e===`glider`&&typeof Av==`function`?Av({planeColor:co.planeColor===void 0?16777215:co.planeColor,planeMat:Pv,planeWhiteMat:Nv}):e===`twin`&&typeof jv==`function`?jv({planeColor:co.planeColor===void 0?16777215:co.planeColor,planeMat:Pv,planeWhiteMat:Nv}):ey({planeColor:co.planeColor===void 0?16777215:co.planeColor,planeMat:Pv,planeWhiteMat:Nv}),co.airplaneModel=n,co.propGroup=n.propGroup||co.propGroup,co.propGroups=n.propGroups||(co.propGroup?[co.propGroup]:[]),Mv.add(n),n.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=!1)});let r=document.getElementById(`plane-select-group`);r&&r.querySelectorAll(`.scheme-btn`).forEach(t=>{t.classList.toggle(`active`,t.getAttribute(`data-plane`)===e)}),typeof Tv==`function`&&Tv({plane:e},[`plane`,`vehicle`])}ry(ty,!0),Mv.rotation.order=`YXZ`;var iy=new hm(16765347,0);iy.position.set(0,0,-10);var ay=new Tl;ay.position.set(0,-20,-100),Mv.add(ay),iy.target=ay,iy.angle=Math.PI/4,iy.penumbra=1,iy.distance=1500,iy.decay=2;var oy=new _m(16765347,0,50);oy.position.set(0,5,0);var sy=15e3,cy=.3;oy.decay=1,Mv.add(oy),Mv.add(iy);var ly=0,uy=0,dy=445.5,fy=io.parsedLat,py=io.parsedLon,my=io.parsedAlt;if(fy!=null&&(uy=-fy*5e3),py!=null&&(ly=py*5e3),my!=null)dy=my/25+45.5;else if(fy!==null||py!==null)try{dy=io.getElevation(ly,uy,Dv,{WATER_LEVEL:40,MAP_WORLD_SIZE:_v===void 0?1e4:_v,MAP_HEIGHT_SCALE:400})+400}catch(e){console.warn(`Failed to calculate exact starting height, using default flying altitude:`,e),dy=445.5}Mv.position.set(ly,dy,uy),Mv.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=!1)});var hy=new K(0,1,0),gy=new Map,_y=new Set,vy=new Set,yy=[],by=[],xy=new Map;function Sy(e,t,n){let r=e.uuid+`_`+(Array.isArray(t)?t.map(e=>e.uuid).join():t.uuid);xy.has(r)||xy.set(r,[]);let i=xy.get(r);for(let e=i.length-1;e>=0;e--)if(i[e].instanceMatrix.count>=n){let t=i.splice(e,1)[0];return t.count=n,t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t}let a=new fd(e,t,Math.max(n,16));return a.frustumCulled=!1,a.count=n,a}function Cy(e){if(!e.geometry||!e.material){e.dispose&&e.dispose();return}let t=e.geometry.uuid+`_`+(Array.isArray(e.material)?e.material.map(e=>e.uuid).join():e.material.uuid);xy.has(t)||xy.set(t,[]),e.userData={},e.parent&&e.parent.remove(e);let n=xy.get(t);n.includes(e)||n.push(e)}var wy=new Set;function Ty(){co.chunkQueue=[],wy.clear()}var Ey={uTime:{value:0},uSpecularDir:{value:new K(0,1,0)},uSunColor:{value:new q(16777215)}},Dy=io!==void 0&&io.GRAPHICS_PRESET||localStorage.getItem(`chill_flight_graphics_preset`),Oy=localStorage.getItem(`chill_flight_quality`),ky=Dy===`low`||!Dy&&Oy&&parseInt(Oy)<=20,Ay=-5e3,jy=5e3,My=$({vertexColors:!0,flatShading:!0,roughness:.8}),Ny=$({vertexColors:!0,transparent:!ky,opacity:ky?1:.85,metalness:.1,roughness:.05,flatShading:!0,depthWrite:!1});My.onBeforeCompile=e=>{e.uniforms.uCameraPosXZ=xv.uCameraPosXZ,e.uniforms.uRenderRadius=xv.uRenderRadius,e.uniforms.uSunDirection=xv.uSunDirection,e.uniforms.uTopColor=xv.uTopColor,e.uniforms.uBottomColor=xv.uBottomColor,e.vertexShader=`
    uniform vec2 uCameraPosXZ;
    uniform float uRenderRadius;
    varying float vDistanceXZ;
    varying vec3 vWorldPosition;
  `+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <worldpos_vertex>`,`#include <worldpos_vertex>
     vec4 customWorldPosition = modelMatrix * vec4( transformed, 1.0 );
     vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);
     vWorldPosition = customWorldPosition.xyz;`),e.fragmentShader=`
    uniform float uRenderRadius;
    varying float vDistanceXZ;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    varying vec3 vWorldPosition;
  `+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,`
     #ifdef USE_FOG
       vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
       vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
       float hFog = skyDir.y;
       float baseSunInt = max(0.0, dot(skyDir, uSunDirection));
       float sunFade = smoothstep(-0.25, 0.0, uSunDirection.y);
       float g = pow(baseSunInt * sunFade, 2.0);
       vec3 effBottom = uBottomColor;
       vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
       if (hFog < 0.0) fogSkyColor = effBottom;
       
       float sunElev = uSunDirection.y;
       float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);
       vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(hFog, 0.0));
       vec3 ambientSunGlow = wideGlow * sunFade;
       float haloFade = smoothstep(-0.03, 0.06, sunElev);
       vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8 * haloFade;
       vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
       float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
       vec3 hotCore = coreColor * pow(baseSunInt, 512.0) * coreStrength;
       vec3 totalGlow = (ambientSunGlow + warmHalo + hotCore) * smoothstep(-0.12, 0.04, hFog);
       fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `)},Ny.onBeforeCompile=e=>{e.uniforms.uTime=Ey.uTime,e.uniforms.uCameraPosXZ=xv.uCameraPosXZ,e.uniforms.uRenderRadius=xv.uRenderRadius,e.uniforms.uSunDirection=xv.uSunDirection,e.uniforms.uSpecularDir=Ey.uSpecularDir,e.uniforms.uSunColor=Ey.uSunColor,e.uniforms.uTopColor=xv.uTopColor,e.uniforms.uBottomColor=xv.uBottomColor,e.vertexShader=`
        attribute float aWaterDepth;
        varying float vWaterDepth;
        uniform vec2 uCameraPosXZ;
        uniform float uRenderRadius;
        varying float vDistanceXZ;
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
    `+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <beginnormal_vertex>`,`
        // Get world position for seamless tiling across chunks
        vec4 worldPosN = modelMatrix * vec4(position, 1.0);

        float macroWaveN = sin(worldPosN.x * 0.0002) * cos(worldPosN.z * 0.00025);
        float waveAmpN = 0.8 + macroWaveN * 0.4;

        // Analytical derivatives of the wave functions for correct lighting
        float dx = waveAmpN * 0.02 * cos(uTime + worldPosN.x * 0.02);
        float dz = -waveAmpN * 0.015 * sin(uTime * 0.8 + worldPosN.z * 0.015);

        // Perpendicular vector for light reflection
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        vSmoothNormal = normalize(mat3(modelMatrix) * objectNormal);
        `),e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`
        vWaterDepth = aWaterDepth;
        vec3 transformed = vec3(position);
        vec4 worldPosV = modelMatrix * vec4(position, 1.0);

        float macroWave = sin(worldPosV.x * 0.0002) * cos(worldPosV.z * 0.00025);
        float waveAmp = 0.8 + macroWave * 0.4;

        // Wave math running in parallel on the GPU
        float wave1 = sin(uTime + worldPosV.x * 0.02) * waveAmp;
        float wave2 = cos(uTime * 0.8 + worldPosV.z * 0.015) * waveAmp;

        transformed.y += wave1 + wave2;
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vDistanceXZ = length(vWorldPosition.xz - uCameraPosXZ);
        `),e.fragmentShader=`
        varying float vWaterDepth;
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSpecularDir;
        uniform vec3 uSunColor;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
        uniform float uRenderRadius;
        varying float vDistanceXZ;
    `+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <dithering_fragment>`,`
        #include <dithering_fragment>

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 sunReflNormal = normalize(vSmoothNormal);
        
        // Fade opacity near shore based on water depth
        float depthOpacity = smoothstep(0.0, 4.0, vWaterDepth);
        gl_FragColor.a *= depthOpacity;
        
        // Add macro-scale spatial variation to break up monotony across different water bodies
        float macro = sin(vWorldPosition.x * 0.0002) * cos(vWorldPosition.z * 0.00025);
        float rippleScale = 0.1 + macro * 0.05; // 0.05 to 0.15
        float timeScale = 1.5 + macro * 0.5; // 1.0 to 2.0
        float perturbStrength = 0.05 + macro * 0.03; // 0.02 to 0.08
        
        // Distance fade for high-frequency normal perturbations to reduce aliasing
        float distanceFade = smoothstep(1500.0, 0.0, vDistanceXZ);
        perturbStrength *= distanceFade;
        
        // Organic high-frequency ripples for shimmering specular
        vec2 pos = vWorldPosition.xz * rippleScale; // Scale of ripples
        float t = uTime * timeScale;
        
        // 3 non-axis-aligned waves to break the grid interference pattern
        float dx = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.8
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * -0.6
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * 0.9;
                 
        float dz = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.6
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * 0.8
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * -0.4;
        
        vec3 rippleNormal = vec3(dx * perturbStrength, 0.0, dz * perturbStrength); // Perturbation strength
        
        sunReflNormal = normalize(sunReflNormal + rippleNormal);

        vec3 halfVector = normalize(uSpecularDir + viewDir);
        float dotNormalHalf = max(dot(sunReflNormal, halfVector), 0.0);
        
        // Specular intensity
        float specularIntensity = pow(dotNormalHalf, 200.0); // Softer, broader organic glints
        float fresnel = 1.0 - max(dot(viewDir, sunReflNormal), 0.0);
        fresnel = pow(fresnel, 3.0);
        
        // Tone down spec during overcast/night
        float lightIntensity = max(0.1, length(uSunColor));
        specularIntensity *= lightIntensity;
        
        gl_FragColor.rgb += uSunColor * specularIntensity * (0.3 + fresnel * 0.7);
        `),e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,`
     #ifdef USE_FOG
       vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
       vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
       float hFog = skyDir.y;
       float baseSunInt = max(0.0, dot(skyDir, uSunDirection));
       float sunFade = smoothstep(-0.25, 0.0, uSunDirection.y);
       float g = pow(baseSunInt * sunFade, 2.0);
       vec3 effBottom = uBottomColor;
       vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
       if (hFog < 0.0) fogSkyColor = effBottom;
       
       float sunElev = uSunDirection.y;
       float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);
       vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(hFog, 0.0));
       vec3 ambientSunGlow = wideGlow * sunFade;
       float haloFade = smoothstep(-0.03, 0.06, sunElev);
       vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8 * haloFade;
       vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
       float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
       vec3 hotCore = coreColor * pow(baseSunInt, 512.0) * coreStrength;
       vec3 totalGlow = (ambientSunGlow + warmHalo + hotCore) * smoothstep(-0.12, 0.04, hFog);
       fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `)};var Py=new Z(1.5,2.5,14,6);Py.translate(0,7,0);function Fy(){let e=new Hd(10,12,6);e.translate(0,14,0);let t=new Hd(8,11,6);t.translate(0,19,0);let n=new Hd(6,10,6);n.translate(0,24,0);let r=new Hd(3.5,8,6);r.translate(0,28.5,0);let i=[e,t,n,r],a=[],o=[],s=[],c=[],l=0;for(let e of i){a.push(...e.attributes.position.array),o.push(...e.attributes.normal.array),e.attributes.uv&&s.push(...e.attributes.uv.array);for(let t=0;t<e.index.array.length;t++)c.push(e.index.array[t]+l);l+=e.attributes.position.count}let u=new Ou;return u.setAttribute(`position`,new J(a,3)),u.setAttribute(`normal`,new J(o,3)),s.length>0&&u.setAttribute(`uv`,new J(s,2)),u.setIndex(c),u}var Iy=Fy();function Ly(){let e=new Z(1.2,1.8,12,6);e.translate(0,6,0);let t=new mp(6,7,5);t.translate(0,14,0);let n=new mp(4.5,7,5);n.translate(3.5,11,2.5);let r=new mp(4.5,7,5);r.translate(-3.5,11,-2.5);let i=new mp(4,7,5);i.translate(-1,12,3.5);let a=new mp(3.5,7,5);a.translate(.5,17,-.5);let o=[t,n,r,i,a],s=[],c=[],l=[],u=0;for(let e of o){s.push(...e.attributes.position.array),c.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)l.push(e.index.array[t]+u);u+=e.attributes.position.count}let d=new Ou;return d.setAttribute(`position`,new J(s,3)),d.setAttribute(`normal`,new J(c,3)),d.setIndex(l),{trunk:e,leaves:d}}var Ry=Ly();function zy(){let e=new Z(1.5,2.2,16,6);e.translate(0,8,0);let t=new mp(6,7,5);t.scale(1,1.2,1),t.translate(0,16,0);let n=new mp(5.5,7,5);n.scale(1,1.3,1),n.translate(0,22,0);let r=new mp(4.5,7,5);r.scale(1,1.2,1),r.translate(0,28,0);let i=new mp(4,7,5);i.scale(1,1.1,1),i.translate(3.5,18,2);let a=new mp(4,7,5);a.scale(1,1.1,1),a.translate(-3.5,19,-2);let o=[t,n,r,i,a],s=[],c=[],l=[],u=0;for(let e of o){s.push(...e.attributes.position.array),c.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)l.push(e.index.array[t]+u);u+=e.attributes.position.count}let d=new Ou;return d.setAttribute(`position`,new J(s,3)),d.setAttribute(`normal`,new J(c,3)),d.setIndex(l),{trunk:e,leaves:d}}var By=zy();function Vy(){let e=new Z(.8,1.4,11,6);e.translate(0,5.5,0);let t=new mp(4.5,7,5);t.scale(1.4,.6,1.4),t.translate(0,12,0);let n=new mp(3.5,7,5);n.scale(1.3,.6,1.3),n.translate(4,10,2);let r=new mp(3.5,7,5);r.scale(1.3,.6,1.3),r.translate(-4,10.5,-2);let i=new mp(3,7,5);i.scale(1.2,.6,1.2),i.translate(1,14,-1.5);let a=new mp(2.5,7,5);a.scale(1.2,.55,1.2),a.translate(-2,11,3);let o=new mp(2,7,5);o.scale(1.3,.55,1.3),o.translate(2.5,8.5,-3);let s=[t,n,r,i,a,o],c=[],l=[],u=[],d=0;for(let e of s){c.push(...e.attributes.position.array),l.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)u.push(e.index.array[t]+d);d+=e.attributes.position.count}let f=new Ou;return f.setAttribute(`position`,new J(c,3)),f.setAttribute(`normal`,new J(l,3)),f.setIndex(u),{trunk:e,leaves:f}}var Hy=Vy();function Uy(){let e=3.5;6*e;let t=[];for(let n=0;n<6;n++){let r=2.2*(1-n/6*.45),i=new Z(r*.85,r,e,6);i.translate(0,n*e+e/2,0);let a=i.attributes.position.array;for(let e=0;e<a.length;e+=3){let t=(a[e+1]/21)**2*2.5;a[e]+=t}i.computeVertexNormals(),t.push(i)}let n=new mp(1.8,6,4,0,Math.PI*2,0,Math.PI/2);n.translate(2.5,21,0),t.push(n);let r=[];for(let e=0;e<9;e++){let t=[{x:0,w:.4},{x:3.5,w:2.8},{x:3.5,w:.8},{x:7.5,w:3.2},{x:7.5,w:1},{x:11.5,w:2.4},{x:11.5,w:.6},{x:15,w:0}],n=.045+e%3*.012,i=[],a=[];for(let e=0;e<t.length;e++){let{x:r,w:a}=t[e],o=r*.42-r*r*n;i.push(r,o-.25,-a/2),i.push(r,o+.25,0),i.push(r,o-.25,a/2)}for(let e=0;e<t.length-1;e++){let t=e*3,n=e*3+1,r=e*3+2,i=(e+1)*3,o=(e+1)*3+1,s=(e+1)*3+2;a.push(t,i,o),a.push(t,o,n),a.push(n,o,s),a.push(n,s,r),a.push(t,o,i),a.push(t,n,o),a.push(n,s,o),a.push(n,r,s)}let o=new Ou;o.setAttribute(`position`,new mu(new Float32Array(i),3)),o.setIndex(a),o.computeVertexNormals();let s=.15*Math.sin(e*1.7);o.rotateX(s);let c=e*Math.PI*2/9+(e%2==0?.1:-.08);o.rotateY(c),o.translate(2.5,21.5+e%3*.25,0),r.push(o)}let i=[],a=[],o=[],s=0;for(let e of t){i.push(...e.attributes.position.array),a.push(...e.attributes.normal.array);let t=e.index?e.index.array:[];for(let e=0;e<t.length;e++)o.push(t[e]+s);s+=e.attributes.position.count}let c=new Ou;c.setAttribute(`position`,new J(i,3)),c.setAttribute(`normal`,new J(a,3)),c.setIndex(o);let l=[],u=[],d=[],f=0;for(let e of r){l.push(...e.attributes.position.array),u.push(...e.attributes.normal.array);let t=e.index?e.index.array:[];for(let e=0;e<t.length;e++)d.push(t[e]+f);f+=e.attributes.position.count}let p=new Ou;return p.setAttribute(`position`,new J(l,3)),p.setAttribute(`normal`,new J(u,3)),p.setIndex(d),{trunk:c,leaves:p}}var Wy=Uy();function Gy(){let e=new Z(.5,1.8,14,5);e.translate(0,7,0);let t=new Z(.3,.6,8,4);t.rotateZ(.8),t.translate(3,10,0);let n=new Z(.3,.5,6,4);n.rotateZ(-1.1),n.translate(-2,8,1);let r=[e,t,n],i=[],a=[],o=[],s=0;for(let e of r){i.push(...e.attributes.position.array),a.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)o.push(e.index.array[t]+s);s+=e.attributes.position.count}let c=new Ou;return c.setAttribute(`position`,new J(i,3)),c.setAttribute(`normal`,new J(a,3)),c.setIndex(o),c}var Ky=Gy(),qy=$({color:6111287,flatShading:!0}),Jy=$({color:16777215,flatShading:!0}),Yy=$({color:9268835,flatShading:!0}),Xy=new Wd(3,0),Zy=$({color:8947848,flatShading:!0}),Qy=$({color:14540253,flatShading:!0}),$y=$({color:13808780,flatShading:!0});function eb(){let e=[],t=1.4,n=new Z(t*.9,t,14,8);n.translate(0,14/2,0),e.push(n);let r=new mp(t*.9,8,4,0,Math.PI*2,0,Math.PI/2);r.translate(0,14,0),e.push(r);function i(n,r,i,a){let o=new Z(1,1,i,8);o.rotateZ(Math.PI/2);let s=n*(t+i/2-.5);o.translate(s,r,0),e.push(o);let c=new mp(1,8,4),l=n*(t+i-.5);c.translate(l,r,0),e.push(c);let u=new Z(1*.9,1,a,8);u.translate(l,r+a/2,0),e.push(u);let d=new mp(1*.9,8,4,0,Math.PI*2,0,Math.PI/2);d.translate(l,r+a,0),e.push(d)}i(1,6,3,6),i(-1,9,2.5,4);let a=[],o=[],s=[],c=0;for(let t of e){a.push(...t.attributes.position.array),t.attributes.normal&&o.push(...t.attributes.normal.array);let e=t.attributes.position.count;if(t.index)for(let e=0;e<t.index.array.length;e++)s.push(t.index.array[e]+c);else for(let t=0;t<e;t++)s.push(t+c);c+=e}let l=new Ou;return l.setAttribute(`position`,new J(a,3)),o.length===a.length?l.setAttribute(`normal`,new J(o,3)):l.computeVertexNormals(),l.setIndex(s),l}var tb=eb(),nb=$({color:5025616,flatShading:!0});function rb(){let e=new Z(1.2,1.8,12,8);e.translate(0,6,0);let t=new mp(7,12,8,0,Math.PI*2,0,Math.PI/2);return t.scale(1,.6,1),t.translate(0,12,0),{trunk:e,leaves:t}}var ib=rb(),ab=$({color:14540253,flatShading:!0}),ob=[10233776,11225020,8069026,12216520,9315498,48340,2533018];function sb(){return new Z(1.5,1.5,.2,8,1,!1,0,Math.PI*1.8)}var cb=sb(),lb=$({color:5025616,flatShading:!0});function ub(){let e=[];for(let t of[{r:1.6,x:0,y:1.4,z:0},{r:1.2,x:1.1,y:1,z:.8},{r:1.3,x:-1,y:.9,z:.9},{r:1.1,x:.8,y:.8,z:-1},{r:1.2,x:-.9,y:1.1,z:-.8},{r:.9,x:.2,y:2.2,z:.3}]){let n=new lp(t.r,1);n.rotateX(t.x*2.5),n.rotateY(t.y*2.5),n.rotateZ(t.z*2.5),n.scale(1,.8,1),n.translate(t.x,t.y,t.z),e.push(n)}let t=[],n=[],r=[],i=0;for(let a of e){t.push(...a.attributes.position.array),a.attributes.normal&&n.push(...a.attributes.normal.array);let e=a.attributes.position.count;if(a.index)for(let e=0;e<a.index.array.length;e++)r.push(a.index.array[e]+i);else for(let t=0;t<e;t++)r.push(t+i);i+=e}let a=new Ou;return a.setAttribute(`position`,new J(t,3)),n.length===t.length?a.setAttribute(`normal`,new J(n,3)):a.computeVertexNormals(),a.setIndex(r),a}var db=ub(),fb=$({color:16777215,flatShading:!0});function pb(){let e=new mp(3,8,8);e.translate(0,2.5,0);let t=new mp(2,8,8);t.translate(0,6.5,0);let n=new mp(1.5,8,8);n.translate(0,9.5,0);let r=new Hd(.3,1.5,4);r.rotateX(Math.PI/2),r.translate(0,9.5,1.5);let i=[e,t,n],a=[],o=[],s=[],c=0;for(let e of i){a.push(...e.attributes.position.array),o.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)s.push(e.index.array[t]+c);c+=e.attributes.position.count}let l=new Ou;return l.setAttribute(`position`,new J(a,3)),l.setAttribute(`normal`,new J(o,3)),l.setIndex(s),{body:l,nose:r}}var mb=pb(),hb=$({color:16777215,flatShading:!0}),gb=$({color:16747520,flatShading:!0}),_b=new X(10,8,10);_b.translate(0,4,0);var vb=new Hd(8.5,6,4);vb.rotateY(Math.PI/4),vb.translate(0,11,0);var yb=new X(2,2.5,.5),bb=new X(2.5,4.5,.5),xb=new X(1.5,5,1.5);xb.translate(0,11,0);var Sb=$({color:6045747,flatShading:!0}),Cb=$({color:9124410,flatShading:!0}),wb=new X(10,14,10);wb.translate(0,7,0);var Tb=new Hd(8.5,7,4);Tb.rotateY(Math.PI/4),Tb.translate(0,17.5,0);var Eb=new X(1.5,5,1.5);Eb.translate(0,17.5,0);var Db=new Z(4,4,6,8);Db.translate(0,3,0);var Ob=new Hd(5.5,5,8);Ob.translate(0,8.5,0);var kb=$({color:15123072,flatShading:!0}),Ab=new Z(8,16,20,6,2);Ab.translate(0,10,0);var jb=Ab.attributes.position.array;for(let e=0;e<jb.length;e+=3){let t=jb[e],n=jb[e+2],r=Math.atan2(n,t);jb[e]+=Math.cos(r*3)*2,jb[e+2]+=Math.sin(r*3)*2,jb[e+1]+=Math.sin(t*.5)*1.5}Ab.computeVertexNormals();var Mb=new Z(15,18,4,7,1);Mb.translate(0,2,0);var Nb=Mb.attributes.position.array;for(let e=0;e<Nb.length;e+=3){let t=Nb[e],n=Nb[e+2],r=Math.atan2(n,t);Nb[e]+=Math.cos(r*4)*1.5,Nb[e+2]+=Math.sin(r*4)*1.5,Nb[e+1]+=Math.sin(t*.3)*.3}Mb.computeVertexNormals();var Pb=$({color:13693173,emissive:662568,roughness:.15,metalness:.05,flatShading:!0}),Fb=new Z(1.1,1.3,3.2,6);Fb.translate(0,1.6,0);var Ib=new X(1.4,2.4,.3);Ib.translate(0,1.5,1.2);var Lb=new mp(1,6,6);Lb.translate(0,3.8,.2);var Rb=new Hd(.3,.9,4);Rb.rotateX(Math.PI/2),Rb.translate(0,3.8,1.5);var zb=new X(.25,2,.8),Bb=zb.clone();Bb.rotateZ(-.15),Bb.translate(-1.4,1.8,.2);var Vb=zb.clone();Vb.rotateZ(.15),Vb.translate(1.4,1.8,.2);var Hb=new X(.7,.2,1.3),Ub=Hb.clone();Ub.translate(-.6,.1,.4);var Wb=Hb.clone();Wb.translate(.6,.1,.4);var Gb=$({color:2236962,flatShading:!0}),Kb=$({color:16777215,flatShading:!0}),qb=$({color:16753920,flatShading:!0}),Jb=e=>{e.uniforms.uTime=hC.uTime,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;`),e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
        #else
        float phase = 0.0;
        #endif
        // Waddling flag (e.g., 60% waddle, 40% stand still)
        float isWaddling = step(0.4, fract(phase * 1.543));
        
        // Waddling animation: sway side to side (rotation around Z axis)
        float waddleCycle = uTime * 4.0 + phase;
        float sway = sin(waddleCycle) * 0.15 * isWaddling;
        float bob = abs(cos(waddleCycle)) * 0.2 * isWaddling;
        
        // Calculate circular walk path
        float walkAngle = uTime * 0.8 + phase * 2.5;
        float walkRadius = 2.5; // Walk in a small 2.5-unit circle
        
        // Walk rotation around Y-axis (tangent to circle: walkAngle + PI/2)
        float ry = (walkAngle + 1.5708) * isWaddling;
        float cy = cos(ry);
        float sy = sin(ry);
        mat3 rotY = mat3(
          cy,  0.0, sy,
          0.0, 1.0, 0.0,
          -sy, 0.0, cy
        );
        
        // Apply waddle sway (Z rotation)
        float cz = cos(sway);
        float sz = sin(sway);
        mat3 rotZ = mat3(
          cz, -sz, 0.0,
          sz,  cz, 0.0,
          0.0, 0.0, 1.0
        );
        
        // Apply local rotations
        transformed = rotY * rotZ * transformed;
        
        // Add vertical bobbing and circular XZ translation
        transformed.y += bob;
        transformed.x += cos(walkAngle) * walkRadius * isWaddling;
        transformed.z += sin(walkAngle) * walkRadius * isWaddling;
    `)};Gb.onBeforeCompile=Jb,Kb.onBeforeCompile=Jb,qb.onBeforeCompile=Jb;var Yb=[$({color:16115400,flatShading:!0}),$({color:14268827,flatShading:!0}),$({color:11584672,flatShading:!0}),$({color:13162728,flatShading:!0}),$({color:15255728,flatShading:!0}),$({color:13417420,flatShading:!0})],Xb=[$({color:6111287,flatShading:!0}),$({color:8077098,flatShading:!0}),$({color:5533306,flatShading:!0}),$({color:4868666,flatShading:!0})],Zb=[];for(let e=0;e<5;e++)Zb.push($({color:4876938,emissive:16766287,emissiveIntensity:0,roughness:.2}));function Qb(){let e=new X(12,2,12);e.translate(0,1,0);let t=new X(9,6,9);t.translate(0,5,0);let n=new X(6.5,5,6.5);n.translate(0,11.5,0);let r=new X(4,4,4);r.translate(0,17.5,0);let i=[e,t,n,r],a=[],o=[],s=[],c=0;for(let e of i){a.push(...e.attributes.position.array),o.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)s.push(e.index.array[t]+c);c+=e.attributes.position.count}let l=new Ou;return l.setAttribute(`position`,new J(a,3)),l.setAttribute(`normal`,new J(o,3)),l.setIndex(s),l}function $b(){let e=new Z(8.5,8.5,1.5,4);e.rotateY(Math.PI/4),e.translate(0,8.5,0);let t=new Z(6,6,1.5,4);t.rotateY(Math.PI/4),t.translate(0,14.5,0);let n=new Z(4,4,1.5,4);n.rotateY(Math.PI/4),n.translate(0,20,0);let r=new Z(.3,.6,7,6);r.translate(0,25,0);let i=[e,t,n,r],a=[],o=[],s=[],c=0;for(let e of i){a.push(...e.attributes.position.array),o.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)s.push(e.index.array[t]+c);c+=e.attributes.position.count}let l=new Ou;return l.setAttribute(`position`,new J(a,3)),l.setAttribute(`normal`,new J(o,3)),l.setIndex(s),l}var ex=Qb(),tx=$b(),nx=$({color:4073251,flatShading:!0}),rx=$({color:1793568,flatShading:!0});function ix(){let e=new Sf;e.moveTo(-10,12),e.lineTo(-10,16),e.lineTo(-4,23),e.lineTo(4,23),e.lineTo(10,16),e.lineTo(10,12),e.lineTo(-10,12);let t=new op(e,{depth:30,bevelEnabled:!1});return t.translate(0,0,-15),t}var ax=new X(18,12,28);ax.translate(0,6,0);var ox=ix(),sx=new X(8,9,.5),cx=new X(.5,12.04,.6),lx=new Z(4,4,22,12);lx.translate(0,11,0);var ux=new mp(4,12,8,0,Math.PI*2,0,Math.PI/2);ux.translate(0,22,0);var dx=$({color:10165276,flatShading:!0}),fx=$({color:4073251,flatShading:!0}),px=$({color:15658734,flatShading:!0}),mx=$({color:11184810,metalness:.2,roughness:.6,flatShading:!0}),hx=$({color:12763842,metalness:.3,roughness:.5,flatShading:!0});function gx(){let e=new X(30,10,16);e.translate(0,5,0);let t=new X(18,6,8);t.translate(4,3,-12);let n=new X(9,22,9);n.translate(-16,11,0);let r=[e,t,n],i=[],a=[],o=[],s=0;for(let e of r){i.push(...e.attributes.position.array),a.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)o.push(e.index.array[t]+s);s+=e.attributes.position.count}let c=new Ou;return c.setAttribute(`position`,new J(i,3)),c.setAttribute(`normal`,new J(a,3)),c.setIndex(o),c}function _x(e,t,n,r){let i=new Sf,a=e/2+r;i.moveTo(-a,0),i.lineTo(a,0),i.lineTo(0,n),i.lineTo(-a,0);let o=new op(i,{depth:t+r*2,bevelEnabled:!1});return o.translate(0,0,-(t+r*2)/2),o}function vx(){let e=_x(16,30,8,1.5);e.rotateY(Math.PI/2),e.translate(0,10,0);let t=_x(8,18,5,1.5);t.rotateY(Math.PI/2),t.translate(4,6,-12);let n=new Hd(7.5,9,4);n.rotateY(Math.PI/4),n.translate(-16,26.5,0);let r=[e,t,n],i=[],a=[],o=[],s=0;for(let e of r){if(i.push(...e.attributes.position.array),e.attributes.normal&&a.push(...e.attributes.normal.array),e.index)for(let t=0;t<e.index.array.length;t++)o.push(e.index.array[t]+s);else for(let t=0;t<e.attributes.position.count;t++)o.push(t+s);s+=e.attributes.position.count}let c=new Ou;return c.setAttribute(`position`,new J(i,3)),a.length===i.length?c.setAttribute(`normal`,new J(a,3)):c.computeVertexNormals(),c.setIndex(o),c}var yx=gx(),bx=vx(),xx=$({color:10395294,flatShading:!0}),Sx=$({color:5533306,flatShading:!0});function Cx(e){let t=[],n=[];for(let r=0;r<40;r++){let i=r/39*2-1,a=i*500/2,o=270*(1-Math.abs(i)**1.8)+10,s=50+Math.abs(i)**2*60,c=2+Math.floor(Math.abs(i)*2);for(let r=0;r<c;r++){let r=s*(.6+e()*.8),i=s*(.6+e()*.8),c=s*(.6+e()*.8),l=new X(r,i,c);l.rotateY(e()*Math.PI),l.rotateZ((e()-.5)*.8),l.rotateX((e()-.5)*.8);let u=a+(e()-.5)*s*.3,d=o+(e()-.5)*s*.3,f=(e()-.5)*30;if(l.translate(u,d,f),t.push(l),d>60&&e()>.3){let t=new X(r*.9,8+e()*6,c*.9);t.rotateY(e()*Math.PI),t.rotateZ((e()-.5)*.2),t.rotateX((e()-.5)*.2),t.translate(u,d+i/2,f),n.push(t)}}}function r(e){let t=[],n=[],r=[],i=[],a=0;for(let o of e){if(o.attributes.position&&t.push(...o.attributes.position.array),o.attributes.normal&&n.push(...o.attributes.normal.array),o.attributes.uv&&i.push(...o.attributes.uv.array),o.index)for(let e=0;e<o.index.array.length;e++)r.push(o.index.array[e]+a);else for(let e=0;e<o.attributes.position.count;e++)r.push(e+a);a+=o.attributes.position.count}let o=new Ou;return t.length>0&&o.setAttribute(`position`,new J(t,3)),n.length>0&&o.setAttribute(`normal`,new J(n,3)),i.length>0&&o.setAttribute(`uv`,new J(i,2)),r.length>0&&o.setIndex(r),o}let i=r(t),a=r(n);return t.forEach(e=>e.dispose()),n.forEach(e=>e.dispose()),{rock:i,grass:a}}typeof window<`u`&&(window.createRockArchGeometries=Cx);var wx=$({color:8172354});function Tx(){let e=[],t=io.mulberry32(91827);function n(n,r,i,a,o){for(let s=0;s<o;s++)if(t()>.3){let t=s/o*Math.PI*2,c=new X(2,2.5,2);c.translate(Math.cos(t)*n+i,r+1.25,Math.sin(t)*n+a),e.push(c)}}let r=new Z(5,6.5,36,8);r.translate(0,18,0),e.push(r),n(4.8,36,0,0,8);let i=new Z(4.5,6,18,8);i.translate(24,9,4),e.push(i);for(let n=0;n<5;n++){let n=new X(3,t()*4+1,3),r=t()*Math.PI*2;n.rotateY(t()),n.rotateZ(t()*.2),n.translate(Math.cos(r)*3+24,18+t(),Math.sin(r)*3+4),e.push(n)}let a=new X(16,22,14);a.translate(12,11,-12),e.push(a);let o=new X(5,14,4);o.translate(7,7,2),e.push(o);let s=new X(5,14,4);s.translate(17,7,2),e.push(s);let c=new X(16,6,4);c.translate(12,17,2),e.push(c);for(let n=0;n<4;n++)if(t()>.2){let t=new X(2,2.5,4);t.translate(6+n*4,21.25,2),e.push(t)}let l=new X(4,12,12);l.translate(2,6,-6),e.push(l);let u=new X(8,10,4);u.translate(20,5,0),u.rotateY(.1),e.push(u);let d=new X(6,4,3);d.rotateY(.4),d.translate(-6,2,-10),e.push(d);let f=new X(4,6,4);f.rotateY(-.2),f.rotateZ(.1),f.translate(28,3,-4),e.push(f);for(let n=0;n<15;n++){let n=new X(2,2,2);n.rotateX(t()),n.rotateY(t()),n.rotateZ(t());let r=t()*Math.PI*2,i=10+t()*20;n.translate(12+Math.cos(r)*i,1,Math.sin(r)*i),e.push(n)}let p=[],m=[],h=[],g=0;for(let t of e){if(p.push(...t.attributes.position.array),t.attributes.normal&&m.push(...t.attributes.normal.array),t.index)for(let e=0;e<t.index.array.length;e++)h.push(t.index.array[e]+g);else for(let e=0;e<t.attributes.position.count;e++)h.push(e+g);g+=t.attributes.position.count}let _=new Ou;return _.setAttribute(`position`,new J(p,3)),m.length===p.length?_.setAttribute(`normal`,new J(m,3)):_.computeVertexNormals(),_.setIndex(h),_}var Ex=Tx(),Dx=$({color:7901340,flatShading:!0}),Ox=new X(1.2,.8,3.5),kx=new X(1.25,.2,2.5);kx.translate(0,-.35,-.2);var Ax=new X(.8,.8,1);Ax.translate(0,.2,-2);var jx=new Hd(.3,.6,4);jx.rotateX(-Math.PI/2),jx.translate(0,.1,-2.8);var Mx=new X(1.4,.2,1.5);Mx.translate(0,0,2.2);var Nx=new X(5,.1,2.5);Nx.translate(2.5,0,0);var Px=$({color:4861461,flatShading:!0}),Fx=$({color:13808780,flatShading:!0}),Ix=$({color:16763904,flatShading:!0}),Lx=new X(1,.7,3),Rx=new X(.7,.7,.9);Rx.translate(0,.3,-1.8);var zx=new Hd(.2,.7,4);zx.rotateX(-Math.PI/2),zx.translate(0,.2,-2.6);var Bx=new X(1.2,.2,1.2);Bx.translate(0,0,1.8);var Vx=new X(4.5,.1,1.8);Vx.translate(2.25,0,0);var Hx=new X(1.5,.11,1.6);Hx.translate(4,0,0);var Ux=$({color:16777215,flatShading:!0}),Wx=$({color:13421772,flatShading:!0}),Gx=$({color:3355443,flatShading:!0}),Kx=$({color:16766287,flatShading:!0});function qx(e){let t=new El,n=new Y(Ox,Px),r=new Y(kx,Fx),i=new Y(Ax,Px),a=new Y(jx,Ix),o=new Y(Mx,Px),s=new Y(Nx,Px),c=new Y(Nx,Px);return s.rotation.y=Math.PI,t.add(n,r,i,a,o,s,c),t.scale.set(e,e,e),t.userData.wings=[s,c],t}function Jx(e){let t=new El,n=new Y(Lx,Ux),r=new Y(Rx,Ux),i=new Y(zx,Kx),a=new Y(Bx,Ux),o=new El,s=new Y(Vx,Wx),c=new Y(Hx,Gx);o.add(s,c),o.rotation.y=Math.PI;let l=new El,u=new Y(Vx,Wx),d=new Y(Hx,Gx);return l.add(u,d),t.add(n,r,i,a,o,l),t.scale.set(e,e,e),t.userData.wings=[o,l],t}var Yx=new X(1.2,.9,3.5),Xx=new Z(.25,.35,2.5,6);Xx.rotateX(Math.PI/2),Xx.translate(0,.5,-2.5);var Zx=new X(.6,.6,1.2);Zx.translate(0,.5,-4);var Qx=new Hd(.2,.8,4);Qx.rotateX(-Math.PI/2),Qx.translate(0,.5,-4.8);var $x=new X(.65,.3,.5);$x.translate(0,.4,-4);var eS=new X(.8,.4,1.5);eS.translate(0,.2,2);var tS=new X(1,.5,1);tS.translate(0,-.1,1.5);var nS=$({color:9139029,flatShading:!0}),rS=$({color:2236962,flatShading:!0}),iS=$({color:16777215,flatShading:!0}),aS=new X(6,.1,2);aS.translate(3,0,0);function oS(){let e=[],t=new Z(4,9,30,8);t.translate(0,15,0),e.push({geo:t,color:new q(15658734)});for(let t=0;t<3;t++){let n=new X(2,2.5,2);n.translate(0,8+t*6,3.5-t*.5),e.push({geo:n,color:new q(2236962)})}let n=new Z(.5,4.5,8,8);n.translate(0,34,0),e.push({geo:n,color:new q(3817549)});let r=new Z(.8,1.2,10,8);r.rotateX(Math.PI/2),r.translate(0,30,6),e.push({geo:r,color:new q(6045747)});let i=[],a=[],o=[],s=[],c=0;for(let t of e){i.push(...t.geo.attributes.position.array),t.geo.attributes.normal&&a.push(...t.geo.attributes.normal.array);let e=t.geo.attributes.position.count;for(let n=0;n<e;n++)o.push(t.color.r,t.color.g,t.color.b);if(t.geo.index)for(let e=0;e<t.geo.index.array.length;e++)s.push(t.geo.index.array[e]+c);else for(let t=0;t<e;t++)s.push(t+c);c+=e}let l=new Ou;return l.setAttribute(`position`,new J(i,3)),a.length===i.length?l.setAttribute(`normal`,new J(a,3)):l.computeVertexNormals(),l.setAttribute(`color`,new J(o,3)),l.setIndex(s),l}function sS(){let e=[],t=new X(.6,26,.4);t.translate(0,15,0),e.push(t);for(let t=0;t<14;t++){let n=new X(4.5,.3,.2);n.translate(2.25,7+t*1.5,0),e.push(n)}let n=new X(.3,14*1.5,.2);n.translate(4.5,16.75,0),e.push(n);let r=new X(.3,14*1.5,.2);r.translate(.5,16.75,0),e.push(r);let i=[],a=[],o=[],s=0;for(let t of e){i.push(...t.attributes.position.array),t.attributes.normal&&a.push(...t.attributes.normal.array);let e=t.attributes.position.count;if(t.index)for(let e=0;e<t.index.array.length;e++)o.push(t.index.array[e]+s);else for(let t=0;t<e;t++)o.push(t+s);s+=e}let c=new Ou;return c.setAttribute(`position`,new J(i,3)),a.length===i.length?c.setAttribute(`normal`,new J(a,3)):c.computeVertexNormals(),c.setIndex(o),c}var cS=oS(),lS=sS(),uS=$({vertexColors:!0,flatShading:!0,roughness:.9}),dS=$({color:6045747,flatShading:!0,roughness:.9}),fS=new jp({depthPacking:Ps}),pS=new Z(8,9,20,8),mS=new Z(7,8,20,8),hS=new Z(6,7,20,8),gS=new Z(5.5,5.5,6,8),_S=new Z(3,3,5,8),vS=new mp(5.5,8,8,0,Math.PI*2,0,Math.PI/2),yS=new Z(.2,.2,20,4),bS=new X(4,3,.1),xS=$({color:12986408,flatShading:!0}),SS=$({color:16777215,flatShading:!0}),CS=$({color:8077098,flatShading:!0}),wS=$({color:2171169,flatShading:!0}),TS=$({color:2171169,flatShading:!0,transparent:!0,opacity:.4}),ES=$({color:16777130,emissive:16777130,emissiveIntensity:1});function DS(){let e=[],t=new X(1.5,1.5,30);t.translate(-5,.75,15);let n=new X(1.5,1.5,30);n.translate(5,.75,15),e.push(t,n);for(let t=0;t<15;t++){let n=new X(16,.5,1.8);n.translate(0,1.75,1+t*2),e.push(n)}let r=[],i=[],a=[],o=0;for(let t of e){if(r.push(...t.attributes.position.array),t.attributes.normal&&i.push(...t.attributes.normal.array),t.index)for(let e=0;e<t.index.array.length;e++)a.push(t.index.array[e]+o);else for(let e=0;e<t.attributes.position.count;e++)a.push(e+o);o+=t.attributes.position.count}let s=new Ou;return s.setAttribute(`position`,new J(r,3)),i.length===r.length?s.setAttribute(`normal`,new J(i,3)):s.computeVertexNormals(),s.setIndex(a),s}var OS=DS(),kS=new Z(1,1,10,6),AS=$({color:6111287,flatShading:!0}),jS=new X(io.ROAD_WIDTH*2+4,1.5,30);function MS(){let e=new Sf,t=io.ROAD_WIDTH+1.5,n=io.ROAD_WIDTH-9,r=-.75,i=-4.75;e.moveTo(-t,r),e.lineTo(t,r),e.lineTo(n,i),e.lineTo(-n,i),e.closePath();let a=new op(e,{depth:30,bevelEnabled:!1});return a.translate(0,0,-30/2),a.computeVertexNormals(),a}var NS=MS(),PS=new X(1.2,2.6,30);function FS(){let e=new Sf,t=io.ROAD_WIDTH-2,n=6.5,r=-.75,i=-2.2;e.moveTo(-t,r),e.lineTo(t,r),e.lineTo(t,i),e.lineTo(n,-7),e.lineTo(-n,-7),e.lineTo(-t,i),e.closePath();let a=new op(e,{depth:8,bevelEnabled:!1});return a.translate(0,0,-4),a.computeVertexNormals(),a}var IS=FS();function LS(){let e=new Z(1,1,1,8);return e.scale(5,1,4),e.translate(0,-.5,0),e.computeVertexNormals(),e}var RS=LS();function zS(){let e=new Z(1,1,4.5,8);return e.scale(7.5,1,6.5),e.computeVertexNormals(),e}var BS=zS();typeof window<`u`&&(window.bridgeGirderGeo=NS,window.bridgePierCapGeo=IS,window.bridgePierShaftGeo=RS,window.bridgePierFootingGeo=BS);var VS=$({color:4868682,flatShading:!0}),HS=$({color:6447714,flatShading:!0}),US=$({color:5592405,flatShading:!0});typeof window<`u`&&(window.bridgeGirderMat=US);var WS=new Z(.5,.8,25,6);WS.translate(0,12.5,0);var GS=new Z(.3,.5,18,6);GS.rotateZ(Math.PI/2),GS.translate(8.5,24,0);var KS=new X(1.5,.5,1);KS.translate(17,23.8,0);var qS=$({color:2236962,flatShading:!0}),JS=$({color:16777215,emissive:16772795,emissiveIntensity:2,flatShading:!0}),YS=new up(40,40);YS.rotateX(-Math.PI/2);var XS=document.createElement(`canvas`);XS.width=128,XS.height=128;var ZS=XS.getContext(`2d`),QS=ZS.createRadialGradient(64,64,0,64,64,64);QS.addColorStop(0,`rgba(120, 110, 60, 0.4)`),QS.addColorStop(.2,`rgba(100, 90, 45, 0.25)`),QS.addColorStop(.5,`rgba(60, 50, 25, 0.1)`),QS.addColorStop(1,`rgba(0, 0, 0, 0.0)`),ZS.fillStyle=QS,ZS.fillRect(0,0,128,128);var $S=new Uu({map:new Rd(XS),transparent:!0,opacity:1,blending:2,depthWrite:!1});$S.onBeforeCompile=e=>{xv&&(e.uniforms.uCameraPosXZ=xv.uCameraPosXZ,e.uniforms.uRenderRadius=xv.uRenderRadius),e.vertexShader=`
    uniform vec2 uCameraPosXZ;
    varying float vDistanceXZ;
  `+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <worldpos_vertex>`,`#include <worldpos_vertex>
     vec4 customWorldPosition = vec4( transformed, 1.0 );
     #ifdef USE_INSTANCING
       customWorldPosition = instanceMatrix * customWorldPosition;
     #endif
     customWorldPosition = modelMatrix * customWorldPosition;
     vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);`),e.fragmentShader=`
    uniform float uRenderRadius;
    varying float vDistanceXZ;
  `+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,`#include <fog_fragment>
     if (uRenderRadius > 0.0) {
       float distRatio = vDistanceXZ / uRenderRadius;
       gl_FragColor.a *= (1.0 - smoothstep(0.75, 0.95, distRatio));
     }`)};function eC(){let e=new X(8,6,10);e.translate(0,3,0);let t=e.attributes.position.array;for(let e=0;e<t.length;e+=3)t[e+1]>5&&(t[e]=0);return e.computeVertexNormals(),e}var tC=eC();function nC(){let e=new X(4,4,.2);e.translate(0,2,5.05);let t=e.attributes.position.array;for(let e=0;e<t.length;e+=3)t[e+1]>3&&(t[e]=0);return e.computeVertexNormals(),e}var rC=nC();function iC(){let e=new Z(.2,.2,Math.sqrt(52),4),t=Math.atan2(4,6),n=e.clone();n.rotateZ(t),n.translate(2,3,5.2);let r=e.clone();r.rotateZ(-t),r.translate(-2,3,5.2);let i=e.clone();i.rotateZ(t),i.translate(2,3,-5.2);let a=e.clone();a.rotateZ(-t),a.translate(-2,3,-5.2);let o=new Z(.2,.2,11,4);o.rotateX(Math.PI/2),o.translate(0,6.1,0);let s=[n,r,i,a,o],c=[],l=[],u=[],d=0;for(let e of s){c.push(...e.attributes.position.array),l.push(...e.attributes.normal.array);for(let t=0;t<e.index.array.length;t++)u.push(e.index.array[t]+d);d+=e.attributes.position.count}let f=new Ou;return f.setAttribute(`position`,new J(c,3)),f.setAttribute(`normal`,new J(l,3)),f.setIndex(u),f}var aC=iC(),oC=$({color:1118481,flatShading:!0}),sC=[$({color:13808780,flatShading:!0}),$({color:4742207,flatShading:!0}),$({color:1914199,flatShading:!0})],cC=sC[0],lC=new Z(.8,.8,6,6);lC.rotateZ(Math.PI/2);var uC=new mp(2,8,8),dC=$({color:16729344,emissive:16729344,emissiveIntensity:2}),fC=new X(2,2,2),pC=$({color:8947848,transparent:!0,opacity:.4,flatShading:!0}),mC=$({color:14540253,transparent:!0,opacity:.6,flatShading:!0}),hC={uTime:{value:0}};dS.onBeforeCompile=e=>{e.uniforms.uTime=hC.uTime,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;`),e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`
        #include <begin_vertex>
        float c = cos(uTime * 1.5);
        float s = sin(uTime * 1.5);
        mat3 rotZ = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
        transformed = rotZ * transformed;
    `)},fS.onBeforeCompile=dS.onBeforeCompile,dC.onBeforeCompile=e=>{e.uniforms.uTime=hC.uTime,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;`),e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
        #else
        float phase = 0.0;
        #endif
        float pulse = 1.0 + sin(uTime * 10.0 + phase) * 0.2;
        transformed *= pulse;
    `)};var gC=(e,t)=>{e.uniforms.uTime=hC.uTime,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;
varying float vFade;`),e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`
        #include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
        float particleIndex = instanceColor.r * 10.0;
        float phase = instanceColor.g * 10.0;
        #else
        float particleIndex = 0.0;
        float phase = 0.0;
        #endif
        
        float maxLifetime = ${t?`2.4`:`2.0`};
        float offsetTime = mod(uTime * 0.5 + particleIndex * ${t?`0.6`:`0.4`} + phase, maxLifetime);
        float age = offsetTime / maxLifetime;
        
        // Emitter angle combines phase-based unique direction with slow global sway
        float emitterAngle = phase * 1.34 + sin(uTime * 0.2 + phase) * 0.5;
        
        // Dynamic fanning out / cone-spread per particle
        float particleAngle = emitterAngle + (particleIndex - ${t?`1.5`:`2.0`}) * 0.35;
        
        // Turbulence sways that grow larger as the particle rises
        float turbulence = offsetTime * 0.5;
        float swayX = sin(uTime * 1.2 + particleIndex * 2.3 + phase) * turbulence * 3.5;
        float swayZ = cos(uTime * 1.0 + particleIndex * 1.7 + phase * 1.3) * turbulence * 3.5;
        
        float rise = offsetTime * ${t?`45.0`:`60.0`};
        float driftX = cos(particleAngle) * offsetTime * ${t?`12.0`:`15.0`} + swayX;
        float driftZ = sin(particleAngle) * offsetTime * ${t?`12.0`:`15.0`} + swayZ;
        
        float smokeScale = (${t?`0.8`:`1.0`} + particleIndex * ${t?`0.3`:`0.5`}) * (1.0 + offsetTime * ${t?`0.6`:`0.5`});
        
        float st = sin(offsetTime * ${t?`0.5`:`1.0`});
        float ct = cos(offsetTime * ${t?`0.5`:`1.0`});
        mat3 rotY = mat3(ct, 0.0, st, 0.0, 1.0, 0.0, -st, 0.0, ct);
        mat3 rotZ = mat3(ct, -st, 0.0, st, ct, 0.0, 0.0, 0.0, 1.0);
        
        transformed = rotY * rotZ * transformed * smokeScale;
        transformed.x += driftX;
        transformed.y += rise;
        transformed.z += driftZ;
        
        // Smoothstep fade in at start and fade out at end
        float fadeIn = smoothstep(0.0, 0.15, age);
        float fadeOut = 1.0 - smoothstep(0.4, 1.0, age);
        vFade = fadeIn * fadeOut;
    `),e.fragmentShader=`varying float vFade;
`+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>
diffuseColor.a *= vFade;`)};pC.onBeforeCompile=e=>gC(e,!1),mC.onBeforeCompile=e=>gC(e,!0);function _C(){let e=new X(3.6,2,8),t=new X(3.6,2,4);t.translate(0,0,-6);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-5&&(n[e]=0);t.computeVertexNormals();let r=[...e.attributes.position.array,...t.attributes.position.array],i=[...e.attributes.normal.array,...t.attributes.normal.array],a=[...e.index.array],o=e.attributes.position.count;for(let e=0;e<t.index.array.length;e++)a.push(t.index.array[e]+o);let s=new Ou;return s.setAttribute(`position`,new J(r,3)),s.setAttribute(`normal`,new J(i,3)),s.setIndex(a),s}var vC=_C();vC.translate(0,.5,0);function yC(){let e=new X(4,.4,8.2),t=new X(4,.4,4.2);t.translate(0,0,-6.2);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-5.2&&(n[e]=0);t.computeVertexNormals();let r=[...e.attributes.position.array,...t.attributes.position.array],i=[...e.attributes.normal.array,...t.attributes.normal.array],a=[...e.index.array],o=e.attributes.position.count;for(let e=0;e<t.index.array.length;e++)a.push(t.index.array[e]+o);let s=new Ou;return s.setAttribute(`position`,new J(r,3)),s.setAttribute(`normal`,new J(i,3)),s.setIndex(a),s}var bC=yC();bC.translate(0,1.7,0);function xC(){let e=new X(3.2,.2,7.8),t=new X(3.2,.2,4);t.translate(0,0,-5.9);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-4.9&&(n[e]=0);t.computeVertexNormals();let r=[...e.attributes.position.array,...t.attributes.position.array],i=[...e.attributes.normal.array,...t.attributes.normal.array],a=[...e.index.array],o=e.attributes.position.count;for(let e=0;e<t.index.array.length;e++)a.push(t.index.array[e]+o);let s=new Ou;return s.setAttribute(`position`,new J(r,3)),s.setAttribute(`normal`,new J(i,3)),s.setIndex(a),s}var SC=xC();SC.translate(0,1.91,0);var CC=new Z(.15,.15,12,4);CC.translate(0,6,-1);var wC=new Z(.1,.1,7,4);wC.rotateX(Math.PI/2),wC.translate(0,2.5,2.5);var TC=new Ou,EC=new Float32Array([0,2.5,-.9,0,11,-.9,0,2.5,5.5]);TC.setAttribute(`position`,new mu(EC,3)),TC.computeVertexNormals();var DC=[$({color:11141120,flatShading:!0}),$({color:17408,flatShading:!0}),$({color:85,flatShading:!0})],OC=$({color:16777215,flatShading:!0}),kC=$({color:13808780,flatShading:!0}),AC=$({color:16777215,flatShading:!0,side:2});function jC(e){let t=[],n=[],r=[],i=0;for(let a of e){if(t.push(...a.attributes.position.array),a.attributes.normal&&n.push(...a.attributes.normal.array),a.index)for(let e=0;e<a.index.array.length;e++)r.push(a.index.array[e]+i);else{let e=a.attributes.position.count;for(let t=0;t<e;t++)r.push(t+i)}i+=a.attributes.position.count}let a=new Ou;return a.setAttribute(`position`,new J(t,3)),n.length>0&&a.setAttribute(`normal`,new J(n,3)),a.setIndex(r),a}function MC(){let e=new X(6,4,16),t=new X(6,4,6);t.translate(0,0,-11);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-10&&(n[e]*=.2);t.computeVertexNormals();let r=new X(6,6,6);r.translate(0,1,11);let i=jC([e,t,r]),a=i.attributes.position.array;for(let e=0;e<a.length;e+=3)a[e+1]<0&&(a[e]*=.6);return i.computeVertexNormals(),i}var NC=MC();NC.translate(0,1,0);function PC(){let e=new X(6.4,.4,16.4),t=new X(6.4,.4,6.4);t.translate(0,0,-11.4);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-10.4&&(n[e]*=.2);t.computeVertexNormals();let r=new X(6.4,.4,6.4);return r.translate(0,1,11.4),jC([e,t,r])}var FC=PC();FC.translate(0,3,0);function IC(){let e=new X(5.8,.2,15.8),t=new X(5.8,.2,5.8);t.translate(0,0,-10.8);let n=t.attributes.position.array;for(let e=0;e<n.length;e+=3)n[e+2]<-9.8&&(n[e]*=.2);t.computeVertexNormals();let r=new X(5.8,.2,5.8);return r.translate(0,1,10.8),jC([e,t,r])}var LC=IC();LC.translate(0,3.2,0);function RC(){let e=new Z(.3,.3,24,6);e.translate(0,14,0);let t=new Z(.25,.25,20,6);t.translate(0,12,-7);let n=new Z(.2,.2,16,6);n.translate(0,11,8);let r=new Z(.15,.15,10,6);r.rotateX(-Math.PI/3),r.translate(0,5,-12);let i=[],a=(e,t,n)=>{let r=new Z(.1,.1,e,6);r.rotateZ(Math.PI/2),r.translate(0,t,n),i.push(r)};return a(10.5,15,-.2),a(8.5,20.5,-.2),a(5.5,25,-.2),a(8.5,12.5,-7.2),a(6.5,17,-7.2),a(6.5,12.5,7.8),jC([e,t,n,r,...i])}var zC=RC();function BC(){let e=[],t=(t,n,r,i)=>{let a=new X(t,n,.2,4,2),o=a.attributes.position.array;for(let e=0;e<o.length;e+=3){let t=o[e],r=o[e+1],i=(n/2-r)/n;o[e+2]+=t*t*.05*i,o[e+2]-=i*1.5}a.computeVertexNormals(),a.translate(0,r,i),e.push(a)};return t(10,6,12,-.2),t(8,5,18,-.2),t(5,4,23,-.2),t(8,5,10,-7.2),t(6,4,15,-7.2),t(6,5,10,7.8),jC(e)}var VC=BC(),HC=new up(3,2,4,2);HC.rotateY(Math.PI/2),HC.translate(0,25,1.5);var UC=HC.attributes.position.array;for(let e=0;e<UC.length;e+=3){let t=UC[e+2];UC[e]+=Math.sin(t*2)*.3}HC.computeVertexNormals();var WC=new X(.2,.4,.5);WC.translate(0,25.2,1.5);var GC=new X(.2,.8,.15);GC.rotateX(Math.PI/4),GC.translate(0,24.6,1.5);var KC=new X(.2,.8,.15);KC.rotateX(-Math.PI/4),KC.translate(0,24.6,1.5);var qC=jC([WC,GC,KC]),JC=qC.attributes.position.array;for(let e=0;e<JC.length;e+=3){let t=JC[e+2];JC[e]+=Math.sin(t*2)*.3}qC.computeVertexNormals();var YC=$({color:4006676,flatShading:!0}),XC=$({color:9109504,flatShading:!0}),ZC=$({color:328965,flatShading:!0,side:2}),QC=$({color:15658734,flatShading:!0}),$C=[$({color:1118481,flatShading:!0,side:2}),$({color:16777215,flatShading:!0,side:2}),$({color:13812903,flatShading:!0,side:2}),$({color:6684672,flatShading:!0,side:2})],ew=new Uu({color:464158,transparent:!0,opacity:.35,side:2}),tw=jC([vC,bC,SC,CC,wC,TC]),nw=jC([NC,FC,LC,zC,VC,HC,qC]),rw=new Z(40,2,500,16,1,!0);rw.rotateX(Math.PI/2),rw.translate(0,0,250);var iw=rw.attributes.position.count,aw=new Float32Array(iw*3),ow=rw.attributes.position.array,sw=new q(16777130);for(let e=0;e<iw;e++){let t=ow[e*3+2],n=Math.max(0,1-t/500)**1.5;aw[e*3]=sw.r*n,aw[e*3+1]=sw.g*n,aw[e*3+2]=sw.b*n}rw.setAttribute(`color`,new mu(aw,3));var cw=new Uu({vertexColors:!0,transparent:!0,opacity:gv,blending:2,side:2,depthWrite:!1}),lw=null,uw=null;function dw(){lw||(lw=new hm(16777130,0,3e3,Math.PI/6,.8,2),Ov.add(lw),Ov.add(lw.target),uw=new Y(rw,cw),uw.visible=!1,Ov.add(uw),ro.info(`[Lighthouse] Persistent light and beam initialized.`))}var fw=new Z(60,60,15,16),pw=new Uu({color:16729344}),mw={getStructure:function(e,t=0,n={}){switch(e){case`streetlight`:return[{geo:WS,mat:qS,pos:[0,0,0],rot:[0,t,0]},{geo:GS,mat:qS,pos:[0,0,0],rot:[0,t,0]},{geo:KS,mat:JS,pos:[0,0,0],rot:[0,t,0]}];case`house`:{let e=(n.bodyId||0)%Yb.length,r=(n.roofId||0)%Xb.length,i=new K(0,2.25,5.1).applyAxisAngle(hy,t),a=new K(-3,4,5.1).applyAxisAngle(hy,t),o=new K(3,4,5.1).applyAxisAngle(hy,t),s=new K(0,4,-5.1).applyAxisAngle(hy,t),c=new K(2.5,0,-2.5).applyAxisAngle(hy,t);return[{geo:_b,mat:Yb[e],pos:[0,0,0],rot:[0,t,0]},{geo:vb,mat:Xb[r],pos:[0,0,0],rot:[0,t,0]},{geo:bb,mat:Sb,pos:[i.x,i.y,i.z],rot:[0,t,0]},{geo:xb,mat:Cb,pos:[c.x,c.y,c.z],rot:[0,t,0]},{geo:yb,mat:Zb[0],pos:[a.x,a.y,a.z],rot:[0,t,0]},{geo:yb,mat:Zb[1],pos:[o.x,o.y,o.z],rot:[0,t,0]},{geo:yb,mat:Zb[2],pos:[s.x,s.y,s.z],rot:[0,t,0]}]}case`two_story_house`:{let e=(n.bodyId||0)%Yb.length,r=(n.roofId||0)%Xb.length,i=new K(0,2.25,5.1).applyAxisAngle(hy,t),a=new K(-3,4,5.1).applyAxisAngle(hy,t),o=new K(3,4,5.1).applyAxisAngle(hy,t),s=new K(0,4,-5.1).applyAxisAngle(hy,t),c=new K(0,10,5.1).applyAxisAngle(hy,t),l=new K(-3,10,5.1).applyAxisAngle(hy,t),u=new K(3,10,5.1).applyAxisAngle(hy,t),d=new K(-3,10,-5.1).applyAxisAngle(hy,t),f=new K(3,10,-5.1).applyAxisAngle(hy,t),p=new K(2.5,0,-2.5).applyAxisAngle(hy,t);return[{geo:wb,mat:Yb[e],pos:[0,0,0],rot:[0,t,0]},{geo:Tb,mat:Xb[r],pos:[0,0,0],rot:[0,t,0]},{geo:bb,mat:Sb,pos:[i.x,i.y,i.z],rot:[0,t,0]},{geo:Eb,mat:Cb,pos:[p.x,p.y,p.z],rot:[0,t,0]},{geo:yb,mat:Zb[0],pos:[a.x,a.y,a.z],rot:[0,t,0]},{geo:yb,mat:Zb[1],pos:[o.x,o.y,o.z],rot:[0,t,0]},{geo:yb,mat:Zb[2],pos:[s.x,s.y,s.z],rot:[0,t,0]},{geo:yb,mat:Zb[0],pos:[c.x,c.y,c.z],rot:[0,t,0]},{geo:yb,mat:Zb[1],pos:[l.x,l.y,l.z],rot:[0,t,0]},{geo:yb,mat:Zb[2],pos:[u.x,u.y,u.z],rot:[0,t,0]},{geo:yb,mat:Zb[3],pos:[d.x,d.y,d.z],rot:[0,t,0]},{geo:yb,mat:Zb[4],pos:[f.x,f.y,f.z],rot:[0,t,0]}]}case`straw_hut`:return[{geo:Db,mat:kb,pos:[0,0,0],rot:[0,t,0]},{geo:Ob,mat:kb,pos:[0,0,0],rot:[0,t,0]}];case`pagoda`:return[{geo:ex,mat:nx,pos:[0,0,0],rot:[0,t,0]},{geo:tx,mat:rx,pos:[0,0,0],rot:[0,t,0]}];case`barn`:{let e=new K(0,4.5,14.1).applyAxisAngle(hy,t),n=new K(0,4.5,-14.1).applyAxisAngle(hy,t),r=new K(12,0,0).applyAxisAngle(hy,t);return[{geo:ax,mat:dx,pos:[0,0,0],rot:[0,t,0]},{geo:ox,mat:fx,pos:[0,0,0],rot:[0,t,0]},{geo:sx,mat:px,pos:[e.x,e.y,e.z],rot:[0,t,0]},{geo:cx,mat:dx,pos:[e.x,e.y,e.z],rot:[0,t,Math.atan2(8,9)]},{geo:cx,mat:dx,pos:[e.x,e.y,e.z],rot:[0,t,-Math.atan2(8,9)]},{geo:sx,mat:px,pos:[n.x,n.y,n.z],rot:[0,t,0]},{geo:cx,mat:dx,pos:[n.x,n.y,n.z],rot:[0,t,Math.atan2(8,9)]},{geo:cx,mat:dx,pos:[n.x,n.y,n.z],rot:[0,t,-Math.atan2(8,9)]},{geo:lx,mat:mx,pos:[r.x,r.y,r.z],rot:[0,t,0]},{geo:ux,mat:hx,pos:[r.x,r.y,r.z],rot:[0,t,0]}]}case`monastery`:return[{geo:yx,mat:xx,pos:[0,0,0],rot:[0,t,0]},{geo:bx,mat:Sx,pos:[0,0,0],rot:[0,t,0]}];case`windmill`:{let e=new K(0,0,16.5).applyAxisAngle(hy,t);return[{geo:cS,mat:uS,pos:[0,0,0],rot:[0,t,0],scale:[1.5,1.5,1.5]},{geo:lS,mat:dS,pos:[e.x,45,e.z],rot:[0,t,0],scale:[1.5,1.5,1.5]},{geo:lS,mat:dS,pos:[e.x,45,e.z],rot:[0,t,Math.PI/2],scale:[1.5,1.5,1.5]},{geo:lS,mat:dS,pos:[e.x,45,e.z],rot:[0,t,Math.PI],scale:[1.5,1.5,1.5]},{geo:lS,mat:dS,pos:[e.x,45,e.z],rot:[0,t,3*Math.PI/2],scale:[1.5,1.5,1.5]}]}case`lighthouse`:{let e=new K(16,0,0).applyAxisAngle(hy,t),n=new K(-15,0,10).applyAxisAngle(hy,t);return[{geo:pS,mat:SS,pos:[0,10,0],rot:[0,t,0]},{geo:mS,mat:CS,pos:[0,30,0],rot:[0,t,0]},{geo:hS,mat:SS,pos:[0,50,0],rot:[0,t,0]},{geo:gS,mat:TS,pos:[0,63,0],rot:[0,t,0]},{geo:_S,mat:ES,pos:[0,63,0],rot:[0,t,0]},{geo:vS,mat:wS,pos:[0,66,0],rot:[0,t,0]},{geo:_b,mat:SS,pos:[e.x,0,e.z],rot:[0,t,0]},{geo:vb,mat:xS,pos:[e.x,0,e.z],rot:[0,t,0]},{geo:yS,mat:AS,pos:[n.x,10,n.z],rot:[0,t,0]},{geo:bS,mat:xS,pos:[n.x,20,n.z],rot:[0,t,0]}]}case`campfire`:return[{geo:lC,mat:AS,pos:[0,1,0],rot:[0,t,.5],order:`YXZ`},{geo:lC,mat:AS,pos:[0,1,0],rot:[0,t+2*Math.PI/3,.5],order:`YXZ`},{geo:lC,mat:AS,pos:[0,1,0],rot:[0,t+4*Math.PI/3,.5],order:`YXZ`},{geo:uC,mat:dC,pos:[0,2,0],rot:[0,t,0]}];case`hawk`:return[{geo:Ox,mat:Px,pos:[0,0,0],rot:[0,t,0]},{geo:kx,mat:Fx,pos:[0,0,0],rot:[0,t,0]},{geo:Ax,mat:Px,pos:[0,0,0],rot:[0,t,0]},{geo:jx,mat:Ix,pos:[0,0,0],rot:[0,t,0]},{geo:Mx,mat:Px,pos:[0,0,0],rot:[0,t,0]},{geo:Nx,mat:Px,pos:[0,0,0],rot:[0,t,0]},{geo:Nx,mat:Px,pos:[0,0,0],rot:[0,t,0],scale:[-1,1,1]}];case`seagull`:return[{geo:Lx,mat:Ux,pos:[0,0,0],rot:[0,t,0]},{geo:Rx,mat:Ux,pos:[0,0,0],rot:[0,t,0]},{geo:zx,mat:Kx,pos:[0,0,0],rot:[0,t,0]},{geo:Bx,mat:Ux,pos:[0,0,0],rot:[0,t,0]},{geo:Vx,mat:Wx,pos:[0,0,0],rot:[0,t,0]},{geo:Hx,mat:Gx,pos:[0,0,0],rot:[0,t,0]},{geo:Vx,mat:Wx,pos:[0,0,0],rot:[0,t+Math.PI,0]},{geo:Hx,mat:Gx,pos:[0,0,0],rot:[0,t+Math.PI,0]}];case`goose`:return[{geo:Yx,mat:nS,pos:[0,0,0],rot:[0,t,0]},{geo:Xx,mat:rS,pos:[0,0,0],rot:[0,t,0]},{geo:Zx,mat:rS,pos:[0,0,0],rot:[0,t,0]},{geo:Qx,mat:rS,pos:[0,0,0],rot:[0,t,0]},{geo:$x,mat:iS,pos:[0,0,0],rot:[0,t,0]},{geo:tS,mat:iS,pos:[0,0,0],rot:[0,t,0]},{geo:eS,mat:rS,pos:[0,0,0],rot:[0,t,0]},{geo:aS,mat:nS,pos:[0,0,0],rot:[0,t,0]},{geo:aS,mat:nS,pos:[0,0,0],rot:[0,t,0],scale:[-1,1,1]}];case`sailboat`:return[{geo:vC,mat:DC[(n.bodyId||0)%DC.length],pos:[0,0,0],rot:[0,t,0]},{geo:bC,mat:OC,pos:[0,0,0],rot:[0,t,0]},{geo:SC,mat:kC,pos:[0,0,0],rot:[0,t,0]},{geo:CC,mat:AS,pos:[0,0,0],rot:[0,t,0]},{geo:wC,mat:AS,pos:[0,0,0],rot:[0,t,0]},{geo:TC,mat:AC,pos:[0,0,0],rot:[0,t,0]}];case`pirateship`:{let e=(n.bodyId||0)%$C.length;return[{geo:NC,mat:YC,pos:[0,0,0],rot:[0,t,0]},{geo:FC,mat:XC,pos:[0,0,0],rot:[0,t,0]},{geo:LC,mat:AS,pos:[0,0,0],rot:[0,t,0]},{geo:zC,mat:AS,pos:[0,0,0],rot:[0,t,0]},{geo:VC,mat:$C[e],pos:[0,0,0],rot:[0,t,0]},{geo:HC,mat:ZC,pos:[0,0,0],rot:[0,t,0]},{geo:qC,mat:QC,pos:[0,0,0],rot:[0,t,0]}]}case`volcano_active_elements`:return[{geo:fw,mat:pw,pos:[0,0,0],rot:[0,t,0]}];case`iceberg`:return[{geo:Ab,mat:Pb,pos:[0,-4,0],rot:[0,t,0]},{geo:Ab,mat:Pb,pos:[14,-8,6],rot:[0,t+1.2,0],scale:[.5,.4,.5]},{geo:Ab,mat:Pb,pos:[-12,-9,-8],rot:[0,t-.8,0],scale:[.4,.3,.4]}];case`iceFloe`:return[{geo:Mb,mat:Pb,pos:[0,-1,0],rot:[0,t,0]},{geo:Mb,mat:Pb,pos:[16,-1.8,4],rot:[0,t+.5,0],scale:[.5,.6,.5]},{geo:Mb,mat:Pb,pos:[-15,-2,-6],rot:[0,t-.5,0],scale:[.4,.5,.4]}];case`penguin`:return[{geo:Fb,mat:Gb,pos:[0,0,0],rot:[0,t,0]},{geo:Ib,mat:Kb,pos:[0,0,0],rot:[0,t,0]},{geo:Lb,mat:Gb,pos:[0,0,0],rot:[0,t,0]},{geo:Rb,mat:qb,pos:[0,0,0],rot:[0,t,0]},{geo:Bb,mat:Gb,pos:[0,0,0],rot:[0,t,0]},{geo:Vb,mat:Gb,pos:[0,0,0],rot:[0,t,0]},{geo:Ub,mat:qb,pos:[0,0,0],rot:[0,t,0]},{geo:Wb,mat:qb,pos:[0,0,0],rot:[0,t,0]}];default:return null}}};function hw(e,t){return io.getBiome(e,t,Dv)}var gw=512,_w=gw-1,vw=new Float32Array(gw),yw=new Float32Array(gw),bw=new Float32Array(gw),xw=new Uint8Array(gw);function Sw(){xw.fill(0)}var Cw={WATER_LEVEL:40,MOUNTAIN_LEVEL:180,MAP_WORLD_SIZE:_v,MAP_HEIGHT_SCALE:400};function ww(e,t){let n=Math.round(e*2),r=Math.round(t*2),i=n*.5,a=r*.5,o=(n*73856093^r*19349663)>>>0&_w;if(xw[o]&&vw[o]===i&&yw[o]===a)return bw[o];let s=io.getElevation(e,t,Dv,Cw,Dc.lerp),c=e-7500,l=t-3e3,u=c*c+l*l;if(u<400*400){let n=1-Math.sqrt(u)/400,r=n*n*(3-2*n)*(.7+(Dv.noise2D(e*.002,t*.002)*.5+.5)*.3);s=Math.max(s,40+20*r)}return vw[o]=i,yw[o]=a,bw[o]=s,xw[o]=1,s}var Tw=new q(8172354),Ew=new q(3706428),Dw=new q(16448250),Ow=new q(10663100),kw=new q(14737576),Aw=new q(11574635),jw=new q(16032864),Mw=new q(12877372),Nw=new q(4244735),Pw=new q(8965375),Fw=new q(52945),Iw=new q(10066329),Lw=new q(14540253),Rw=new q(9150866),zw=new q(10506797),Bw=new q(16448250),Vw=new q(8359053),Hw=new q(4344404),Uw=new q(10199720),Ww=new q(7563616),Gw=new q(12733227),Kw=new q(7120552),qw=new q(6111287),Jw=new q(9268835),Yw=new q(16301008),Xw=new q(16573676),Zw=new q(0),Qw=new q(13808780),$w=new q(14596231),eT=new q(9109504),tT=new q(14329120),nT=new q(25600),rT=new q(19712),iT=new q(7048739),aT=new q(5597999),oT=new q(12433259),sT=new q(9124410),cT=new q(6052956),lT=new q(3815994),uT=new q(1723706),dT=new q(1706542),fT=new q(13168640),pT=new q(4915330),mT=new q(65511),hT=new q(4194336),gT=new q(2097152),_T=new q(16777215),vT=new q(16729344),yT=new q(16711935);export{Aw as $,Km as $i,uw as $n,Tb as $r,hw as $t,Kw as A,fo as Aa,kv as Ai,lb as An,kb as Ar,US as At,$w as B,K as Ba,$ as Bi,rx as Bn,rC as Br,Ex as Bt,mT as C,up as Ca,Nv as Ci,Mb as Cn,fC as Cr,bC as Ct,zw as D,Hu as Da,ry as Di,Hy as Dn,mb as Dr,jS as Dt,rT as E,Oc as Ea,Kv as Ei,dw as En,hb as Er,AC as Et,oT as F,Um as Fa,gv as Fi,ib as Fn,YS as Fr,PS as Ft,cT as G,fv as Gi,Fb as Gn,aC as Gr,Cx as Gt,Ww as H,io as Ha,xv as Hi,Rb as Hn,tC as Hr,wy as Ht,aT as I,hm as Ia,hv as Ii,ab as In,$S as Ir,fb as It,vT as J,mu as Ji,Lb as Jn,Iy as Jr,Ry as Jt,lT as K,Xl as Ki,Ub as Kn,My as Kr,Ky as Kt,Bw as L,uo as La,mv as Li,ex as Ln,WS as Lr,db as Lt,Vw as M,Fl as Ma,Dv as Mi,xx as Mn,GS as Mr,BS as Mt,Ow as N,wp as Na,vv as Ni,bx as Nn,KS as Nr,RS as Nt,iT as O,Bm as Oa,jv as Oi,cw as On,gb as Or,VS as Ot,Tw as P,mp as Pa,pv as Pi,Sx as Pn,JS as Pr,HS as Pt,yT as Q,Ic as Qi,Vb as Qn,Eb as Qr,dC as Qt,kw as R,Tm as Ra,_v as Ri,nx as Rn,qS as Rr,tb as Rt,dT as S,Mu as Sa,Pv as Si,Zb as Sn,tw as Sr,CC as St,nT as T,Ad as Ta,Bv as Ti,Pb as Tn,Qy as Tr,TC as Tt,Dw as U,ro as Ua,wv as Ui,Ib as Un,cC as Ur,gy as Ut,Iw as V,co as Va,Cv as Vi,Wy as Vn,oC as Vr,Dx as Vt,Lw as W,Tv as Wi,Gb as Wn,sC as Wr,Sw as Wt,_T as X,Rd as Xi,Kb as Xn,qy as Xr,uC as Xt,hT as Y,Ou as Yi,qb as Yn,Py as Yr,$y as Yt,gT as Z,q as Zi,Bb as Zn,wb as Zr,lC as Zt,Fw as _,Qc as _a,Zv as _i,bb as _n,Cy as _r,wC as _t,Hw as a,El as aa,uS as ai,nS as an,ZC as ar,ax as at,uT as b,Tl as ba,Qv as bi,Xb as bn,Xy as br,vC as bt,qw as c,fd as ca,dS as ci,Xx as cn,qC as cr,ox as ct,Yw as d,_d as da,cy as di,tS as dn,FC as dr,mx as dt,rd as ea,Ny as ei,ww as en,lw as er,yy as et,Xw as f,vo as fa,sy as fi,aS as fn,XC as fr,ux as ft,jw as g,jc as ga,oy as gi,Cb as gn,ew as gr,vy as gt,Gw as h,Dc as ha,iy as hi,xb as hn,nw as hr,px as ht,jy as i,Wm as ia,cS as ii,Yx as in,HC as ir,Jx as it,Pw as j,dp as ja,Ov as ji,yx as jn,Ob as jr,IS as jt,Rw as k,zo as ka,Av as ki,cb as kn,Db as kr,NS as kt,Jw as l,Lu as la,AS as li,eS as ln,QC as lr,fx as lt,tT as m,lo as ma,ny as mi,Yb as mn,$C as mr,cx as mt,mw as n,Vs as na,_y as ni,Qx as nn,kS as nr,hC as nt,Uw as o,tm as oa,fS as oi,$x as on,NC as or,dx as ot,sT as p,Is as pa,ty as pi,_b as pn,VC as pr,hx as pt,Nw as q,Gm as qi,Wb as qn,Jy as qr,Yy as qt,Ay as r,cl as ra,mC as ri,rS as rn,LC as rr,qx as rt,eT as s,id as sa,lS as si,Zx as sn,YC as sr,sx as st,ob as t,bm as ta,Ey as ti,Sy as tn,OS as tr,by as tt,Zw as u,Td as ua,hy as ui,iS as un,zC as ur,lx as ut,Mw as v,Y as va,Xv as vi,Sb as vn,Ty as vr,SC as vt,Ew as w,Fd as wa,Fv as wi,Ab as wn,pC as wr,OC as wt,fT as x,pm as xa,Mv as xi,yb as xn,Zy as xr,DC as xt,pT as y,Uu as ya,$v as yi,vb as yn,wx as yr,kC as yt,Qw as z,G as za,yv as zi,tx as zn,By as zr,nb as zt};