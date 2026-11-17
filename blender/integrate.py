import base64,re,sys
src=open('shop/index.html').read()
glb=base64.b64encode(open('shop-furniture.glb','rb').read()).decode()
def cut(a,b,new):
    global src
    i=src.index(a); j=src.index(b); src=src[:i]+new+src[j:]
# 1. loader import + glb decode (top-level await)
src=src.replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';",1)
src=src.replace("// ---------- materials","""// ---- baked furniture model (embedded)
const GLB_B64="%s";
const _bin=Uint8Array.from(atob(GLB_B64),c=>c.charCodeAt(0));
const GLTF=await new GLTFLoader().parseAsync(_bin.buffer,'');
GLTF.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material&&o.material.map)o.material.map.anisotropy=8}});
function furniture(name){return GLTF.scene.getObjectByName(name).clone(true)}
// ---------- materials""" % glb,1)
# 2. shelf unit: use baked Shelf, keep slots/dice/plaques
shelf_new=r'''function shelfUnit(cx,cz,letter,keys,fills){const g=new THREE.Group();g.position.set(cx,0,cz);scene.add(g);
 const CORE_W=2.0,CORE_D=1.15,TOP=1.35;
 g.add(furniture('Shelf'));
 const sides=[{n:'N',ry:Math.PI,Wf:2.0,Df:.42,dist:CORE_D/2+.21},{n:'S',ry:0,Wf:2.0,Df:.42,dist:CORE_D/2+.21},{n:'E',ry:Math.PI/2,Wf:1.15,Df:.42,dist:CORE_W/2+.21},{n:'W',ry:-Math.PI/2,Wf:1.15,Df:.42,dist:CORE_W/2+.21}];
 const tilt=.17,TH=.95;let idx=0;
 sides.forEach(sd=>{const sg=new THREE.Group();sg.rotation.y=sd.ry;const dir=new THREE.Vector3(0,0,sd.dist).applyAxisAngle(new THREE.Vector3(0,1,0),sd.ry);sg.position.set(dir.x,0,dir.z);g.add(sg);
  const sw=sd.Wf/3;
  for(let i=0;i<3;i++){const n=idx++;const slot=new THREE.Group();slot.position.set(-sd.Wf/2+sw*(i+.5),TH+.05,0);slot.rotation.x=tilt;sg.add(slot);
   const f=fills[n],key=keys[n];if(f>0){const pos=[],mx=sw/2-.075,mz=sd.Df/2-.075;let tr=0;while(pos.length<f&&tr<500){tr++;const px=(R()*2-1)*mx,pz=(R()*2-1)*mz;if(pos.every(p=>Math.hypot(p[0]-px,p[1]-pz)>.085))pos.push([px,pz])}
    while(pos.length<f)pos.push([(R()*2-1)*mx,(R()*2-1)*mz]);
    pos.forEach((p,i)=>{const near=pos.slice(0,i).filter(o=>Math.hypot(o[0]-p[0],o[1]-p[1])<.1).length;die(idsSet[i%7],M[key],.05,p[0],.05+near*.045,p[1],slot,NUM)})}}
  const pl=new THREE.Mesh(new THREE.BoxGeometry(.3,.22,.04),[mWoodD,mWoodD,mWoodD,mWoodD,plaque(letter),mWoodD]);pl.position.set(0,TOP+.17,-.3);pl.scale.setScalar(.6);sg.add(pl);
 });
 return g}
'''
cut("function shelfUnit(","const MK=",shelf_new)
# 3. counter + return -> baked Counter
cut("// ---- counter + return","// ---- lower room","""// ---- counter + return (baked)
{const c=furniture('Counter');c.position.set(13.9,0,5.75);scene.add(c)}
box(.5,.3,.4,mat({color:'#2c2c30',roughness:.4}),16.0,1.26,5.7);
""")
# 4. desk
src=src.replace("box(3.2,.9,1.2,mWoodD,14.8,.45,12.5);box(3.3,.06,1.3,mWood,14.8,.93,12.5);","{const d=furniture('Desk');d.position.set(14.8,0,12.5);scene.add(d)}")
assert "furniture('Desk')" in src and "furniture('Counter')" in src and "furniture('Shelf')" in src
open('shop/index.html','w').write(src)
print('ok',len(src)//1024,'KB')
