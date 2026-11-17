import bpy, bmesh, math, random, sys, time
from mathutils import Vector, Matrix, Euler
t0=time.time()
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
PHI=(1+5**.5)/2
def link(o): sc.collection.objects.link(o); return o
def mat_principled(name,color,rough=.5,metal=0.,trans=0.,ior=1.45):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*color,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if trans: b.inputs['Transmission Weight'].default_value=trans; b.inputs['IOR'].default_value=ior
    return m
def wood_mat(name,c1,c2,scale=5):
    import random as _r
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']; N=nt.nodes; L=nt.links
    ox,oy,oz=_r.uniform(-1,1),_r.uniform(-.5,.5),_r.uniform(-.5,.5)
    mid=tuple((x+y)/2 for x,y in zip(c1,c2))
    tc0=N.new('ShaderNodeTexCoord')
    oi=N.new('ShaderNodeObjectInfo'); cxyz=N.new('ShaderNodeCombineXYZ')
    for i,k in enumerate((41.0,67.0,53.0)):
        mm=N.new('ShaderNodeMath'); mm.operation='MULTIPLY'; mm.inputs[1].default_value=k
        # decorrelate axes: (rand*k) mod 1000 via fract of rand*k*phi
        L.new(oi.outputs['Random'],mm.inputs[0]); L.new(mm.outputs[0],cxyz.inputs[i])
    tc=N.new('ShaderNodeVectorMath'); tc.operation='ADD'
    L.new(tc0.outputs['Object'],tc.inputs[0]); L.new(cxyz.outputs['Vector'],tc.inputs[1])
    # long-grain rings (flat-sawn cathedral figure), axis along X
    mpR=N.new('ShaderNodeMapping'); mpR.inputs['Location'].default_value=(ox,oy,oz)
    wv=N.new('ShaderNodeTexWave'); wv.wave_type='RINGS'; wv.rings_direction='X'; wv.wave_profile='SIN'
    wv.inputs['Scale'].default_value=26; wv.inputs['Distortion'].default_value=2.6; wv.inputs['Detail'].default_value=2; wv.inputs['Detail Scale'].default_value=1.6; wv.inputs['Detail Roughness'].default_value=.65
    # fine streaks along the grain
    mpS=N.new('ShaderNodeMapping'); mpS.inputs['Scale'].default_value=(.45,260,260)
    ns=N.new('ShaderNodeTexNoise'); ns.inputs['Scale'].default_value=1.0; ns.inputs['Detail'].default_value=5; ns.inputs['Roughness'].default_value=.7
    # pores: tiny dashes along the grain
    mpP=N.new('ShaderNodeMapping'); mpP.inputs['Scale'].default_value=(1.4,700,700)
    npor=N.new('ShaderNodeTexNoise'); npor.inputs['Scale'].default_value=1.0; npor.inputs['Detail'].default_value=2
    pr=N.new('ShaderNodeValToRGB'); pr.color_ramp.elements[0].position=.58; pr.color_ramp.elements[1].position=.66
    pr.color_ramp.elements[0].color=(1,1,1,1); pr.color_ramp.elements[1].color=(.12,.1,.1,1)
    # broad tonal drift
    mpB=N.new('ShaderNodeMapping'); mpB.inputs['Scale'].default_value=(.25,4,4)
    nb=N.new('ShaderNodeTexNoise'); nb.inputs['Scale'].default_value=1.5; nb.inputs['Detail'].default_value=3
    g1=N.new('ShaderNodeMix'); g1.data_type='FLOAT'; g1.inputs[0].default_value=.5
    g2=N.new('ShaderNodeMix'); g2.data_type='FLOAT'; g2.inputs[0].default_value=.25
    cr=N.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation='B_SPLINE'
    cr.color_ramp.elements[0].position=.0; cr.color_ramp.elements[0].color=tuple(x*.30 for x in c1)+(1,)
    e=cr.color_ramp.elements.new(.38); e.color=(*c1,1)
    e=cr.color_ramp.elements.new(.68); e.color=(*c2,1)
    cr.color_ramp.elements[-1].position=1.0; cr.color_ramp.elements[-1].color=tuple(min(1,x*2.4) for x in c2)+(1,)
    mulc=N.new('ShaderNodeMix'); mulc.data_type='RGBA'; mulc.blend_type='MULTIPLY'; mulc.inputs[0].default_value=1.0
    rr=N.new('ShaderNodeMapRange'); rr.inputs['From Min'].default_value=0; rr.inputs['From Max'].default_value=1; rr.inputs['To Min'].default_value=.88; rr.inputs['To Max'].default_value=.58
    bump=N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.26; bump.inputs['Distance'].default_value=.0015
    L.new(tc.outputs[0],mpR.inputs['Vector']); L.new(mpR.outputs['Vector'],wv.inputs['Vector'])
    L.new(tc.outputs[0],mpS.inputs['Vector']); L.new(mpS.outputs['Vector'],ns.inputs['Vector'])
    L.new(tc.outputs[0],mpP.inputs['Vector']); L.new(mpP.outputs['Vector'],npor.inputs['Vector']); L.new(npor.outputs['Fac'],pr.inputs['Fac'])
    L.new(tc.outputs[0],mpB.inputs['Vector']); L.new(mpB.outputs['Vector'],nb.inputs['Vector'])
    L.new(wv.outputs['Fac'],g1.inputs[2]); L.new(ns.outputs['Fac'],g1.inputs[3])
    L.new(g1.outputs[0],g2.inputs[2]); L.new(nb.outputs['Fac'],g2.inputs[3])
    L.new(g2.outputs[0],cr.inputs['Fac']); L.new(cr.outputs['Color'],mulc.inputs[6]); L.new(pr.outputs['Color'],mulc.inputs[7])
    L.new(g2.outputs[0],rr.inputs['Value'])
    L.new(g1.outputs[0],bump.inputs['Height']); L.new(bump.outputs['Normal'],b.inputs['Normal'])
    try: b.inputs['Coat Weight'].default_value=0.0
    except Exception as ex: print('coat',ex)
    try: b.inputs['Specular IOR Level'].default_value=.22
    except Exception as ex: print('spec',ex)
    # micro-scratches along the grain (roughness + bump)
    mpK=N.new('ShaderNodeMapping'); mpK.inputs['Scale'].default_value=(.6,900,40)
    nk=N.new('ShaderNodeTexNoise'); nk.inputs['Scale'].default_value=1.0; nk.inputs['Detail'].default_value=1
    kr=N.new('ShaderNodeValToRGB'); kr.color_ramp.elements[0].position=.60; kr.color_ramp.elements[1].position=.68
    L.new(tc.outputs[0],mpK.inputs['Vector']); L.new(mpK.outputs['Vector'],nk.inputs['Vector']); L.new(nk.outputs['Fac'],kr.inputs['Fac'])
    # edge wear: lighter, rougher where bevelled edges catch
    bv=N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value=.012
    ng=N.new('ShaderNodeNewGeometry')
    dt=N.new('ShaderNodeVectorMath'); dt.operation='DOT_PRODUCT'
    em=N.new('ShaderNodeMapRange'); em.inputs['From Min'].default_value=.985; em.inputs['From Max'].default_value=.90; em.inputs['To Min'].default_value=0; em.inputs['To Max'].default_value=1
    nw=N.new('ShaderNodeTexNoise'); nw.inputs['Scale'].default_value=60; nw.inputs['Detail'].default_value=4
    ew=N.new('ShaderNodeMath'); ew.operation='MULTIPLY'
    wc=N.new('ShaderNodeMix'); wc.data_type='RGBA'; wc.blend_type='MIX'
    L.new(bv.outputs['Normal'],dt.inputs[0]); L.new(ng.outputs['Normal'],dt.inputs[1]); L.new(dt.outputs['Value'],em.inputs['Value'])
    L.new(nw.outputs['Fac'],ew.inputs[0]); L.new(em.outputs['Result'],ew.inputs[1])
    # scratches lighten colour slightly and add roughness
    sc_m=N.new('ShaderNodeMath'); sc_m.operation='MULTIPLY'; sc_m.inputs[1].default_value=.35
    L.new(kr.outputs['Color'],sc_m.inputs[0])
    # worn-edge colour = light raw wood
    wc.inputs[7].default_value=tuple(min(1,x*3.2) for x in c2)+(1,)
    L.new(ew.outputs[0],wc.inputs[0]); L.new(mulc.outputs[2],wc.inputs[6]); L.new(wc.outputs[2],b.inputs['Base Color'])
    # roughness: base + edge wear
    rm=N.new('ShaderNodeMath'); rm.operation='ADD'; rm.use_clamp=True
    L.new(rr.outputs['Result'],rm.inputs[0]); L.new(sc_m.outputs[0],rm.inputs[1]); L.new(rm.outputs[0],b.inputs['Roughness'])
    # normal: use bevel normal through bump
    L.new(bv.outputs['Normal'],bump.inputs['Normal'])
    return m
def bevel(o,w=.006,seg=2):
    md=o.modifiers.new('bev','BEVEL'); md.width=w; md.segments=seg; md.limit_method='ANGLE'; md.angle_limit=math.radians(35)
def box(name,size,loc,m,rot=(0,0,0),bw=.007):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
    for v in bm.verts: v.co.x*=size[0]; v.co.y*=size[1]; v.co.z*=size[2]
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); link(o); o.data.materials.append(m)
    o.location=loc; o.rotation_euler=rot
    if bw: bevel(o,bw)
    for p in me.polygons: p.use_smooth=False
    return o
# ---------- dice geometry (unit circumradius)
def poly_hull(pts):
    bm=bmesh.new()
    for p in pts: bm.verts.new(Vector(p).normalized())
    bmesh.ops.convex_hull(bm,input=bm.verts[:])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    bmesh.ops.dissolve_limit(bm,angle_limit=math.radians(1),verts=bm.verts[:],edges=bm.edges[:])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    return bm
def pts_d4(): return [(1,1,1),(1,-1,-1),(-1,1,-1),(-1,-1,1)]
def pts_d6(): return [(x,y,z) for x in(-1,1) for y in(-1,1) for z in(-1,1)]
def pts_d8(): return [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
def pts_d10():
    p=[(0,0,1),(0,0,-1)]
    for k in range(10):
        a=k*math.pi/5; p.append((math.cos(a),math.sin(a),(-.1056 if k%2==0 else .1056)))
    return p
def pts_d12():
    i=1/PHI; p=[(x,y,z) for x in(-1,1) for y in(-1,1) for z in(-1,1)]
    for s1 in(-1,1):
        for s2 in(-1,1): p+=[(0,s1*i,s2*PHI),(s1*i,s2*PHI,0),(s2*PHI,0,s1*i)]
    return p
def pts_d20():
    p=[]
    for s1 in(-1,1):
        for s2 in(-1,1): p+=[(0,s1,s2*PHI),(s1,s2*PHI,0),(s2*PHI,0,s1)]
    return p
KIND={4:pts_d4,6:pts_d6,8:pts_d8,10:pts_d10,100:pts_d10,12:pts_d12,20:pts_d20}
LAB={4:['1','2','3','4'],6:['1','2','3','4','5','6'],8:[str(i) for i in range(1,9)],10:[str(i) for i in range(10)],100:['00']+[str(i*10) for i in range(1,10)],12:[str(i) for i in range(1,13)],20:[str(i) for i in range(1,21)]}
SZ={4:1.05,6:.85,8:.95,10:.95,100:.95,12:1.0,20:1.05}
# numeral meshes (shared)
NUM={}
def numeral_mesh(label):
    if label in NUM: return NUM[label]
    cu=bpy.data.curves.new('t'+label,'FONT'); cu.body=label; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=1.0; cu.extrude=.035
    o=bpy.data.objects.new('t'+label,cu); link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); me=o.data
    w=max(v.co.x for v in me.vertices)-min(v.co.x for v in me.vertices)
    bpy.data.objects.remove(o,do_unlink=True); NUM[label]=(me,w); return NUM[label]
def make_die(kind,body_m,ink_m,r,numerals='up'):
    bm=poly_hull(KIND[kind]())
    faces=[(f.calc_center_median().copy(),f.normal.copy(),math.sqrt(f.calc_area())) for f in bm.faces]
    me=bpy.data.meshes.new('d%d'%kind); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('d%d'%kind,me); link(o); o.data.materials.append(body_m); bevel(o,.03,2)
    for p in me.polygons: p.use_smooth=False
    o.scale=(r*SZ[kind],)*3
    labs=LAB[kind]
    for i,(c,n,sz) in enumerate(faces):
        lab=labs[i%len(labs)]
        nm,w=numeral_mesh(lab)
        no=bpy.data.objects.new('n'+lab,nm); link(no); no.data.materials.clear() if False else None
        if not nm.materials: nm.materials.append(ink_m)
        k=sz*.55; k=min(k,sz*.5/max(w,.6))  # fit width
        no.scale=(k,k,k); no.rotation_mode='QUATERNION'; no.rotation_quaternion=n.to_track_quat('Z','Y')
        no.location=c+n*.012; no.parent=o
    o['faces']=[(tuple(c),tuple(n)) for c,n,sz in faces]
    return o
# ---------- materials
wood=wood_mat('wood',(0.03479, 0.01011, 0.0),(0.0671, 0.0195, 0.0)); woodd=wood_mat('woodd',(0.02485, 0.00722, 0.0),(0.04722, 0.01372, 0.0),6)
pink=mat_principled('pinkmetal',(.95,.5,.65),.36,1.0); gold=mat_principled('goldmetal',(1.0,.72,.22),.38,1.0)
clear=mat_principled('clearblue',(.55,.8,1.0),.04,0.0,1.0)
_nt=clear.node_tree; _va=_nt.nodes.new('ShaderNodeVolumeAbsorption'); _va.inputs['Color'].default_value=(.15,.5,1.0,1); _va.inputs['Density'].default_value=24
_nt.links.new(_va.outputs['Volume'],_nt.nodes['Material Output'].inputs['Volume'])
inkD=mat_principled('inkdark',(.12,.02,.05),.45); inkL=mat_principled('inkwhite',(.95,.93,.88),.45)
floor=wood_mat('floor',(0.04474, 0.013, 0.0),(0.08947, 0.026, 0.0),3)

# ---------- furniture (origin = floor centre; front faces -Y in Blender = +Z in three.js)
def empty(name,loc=(0,0,0),parent=None,rz=0):
    e=bpy.data.objects.new(name,None); link(e); e.location=loc; e.rotation_euler=(0,0,rz)
    if parent: e.parent=parent
    return e
def pb(par,name,size,loc,m,rot=(0,0,0),bw=.007):
    o=box(name,size,loc,m,rot=rot,bw=bw); o.parent=par; return o
tilt=.17; TH=.95
def build_shelf(root):
    CW,CD,TOP=2.0,1.15,1.35
    pb(root,'core',(CW,CD,TOP),(0,0,TOP/2),woodd,bw=.012)
    pb(root,'cap',(CW+.12,CD+.12,.06),(0,0,TOP+.03),wood,bw=.01)
    pb(root,'capmold',(CW+.04,CD+.04,.05),(0,0,TOP-.18),wood,bw=.008)
    for sx in(-1,1): pb(root,'foot',(.16,CD+.2,.08),(sx*(CW/2-.1),0,.04),woodd,bw=.012)
    for n,ry,Wf,Df,dist in [('N',math.pi,2.0,.42,CD/2+.21),('S',0,2.0,.42,CD/2+.21),('E',math.pi/2,1.15,.42,CW/2+.21),('W',-math.pi/2,1.15,.42,CW/2+.21)]:
        t=empty('tray'+n,(0,0,0),root,ry)
        pb(t,'plinth',(Wf,Df,TH-.05),(0,-dist,(TH-.05)/2),woodd,bw=.012)
        pb(t,'slab',(Wf+.08,Df+.06,.07),(0,-dist,TH),wood,rot=(tilt,0,0),bw=.01)
        pb(t,'lip',(Wf+.1,.05,.14),(0,-dist-Df/2,TH+.03),wood,rot=(tilt*.4,0,0),bw=.012)
        pb(t,'cornice',(Wf+.06,Df+.1,.04),(0,-dist,TH-.06),woodd,bw=.008)
        for sx in(-1,1): pb(t,'side',(.05,Df+.06,.2),(sx*(Wf/2+.03),-dist,TH+.08),wood,rot=(tilt,0,0),bw=.01)
        for i in(1,2): pb(t,'div',(.04,Df,.16),(-Wf/2+i*Wf/3,-dist,TH+.09),wood,rot=(tilt,0,0),bw=.008)
def build_counter(root):
    pb(root,'body',(6.0,.92,1.05),(0,0,.525),woodd,bw=.012)
    pb(root,'top',(6.12,1.04,.07),(0,0,1.085),wood,bw=.012)
    pb(root,'kick',(6.0,.06,.1),(0,-.49,.05),woodd,bw=.008)
    for i in range(6): pb(root,'panel',(.88,.03,.68),(-2.5+i,-.47,.55),wood,bw=.012)
    pb(root,'ret',(1.0,1.4,1.05),(-2.5,-1.0,.525),woodd,bw=.012)
    pb(root,'rettop',(1.12,1.52,.07),(-2.5,-1.0,1.087),wood,bw=.012)
    pb(root,'retpanel',(.8,.03,.68),(-2.5,-1.72,.55),wood,bw=.012)
def build_desk(root):
    pb(root,'body',(3.2,1.2,.9),(0,0,.45),woodd,bw=.012)
    pb(root,'top',(3.3,1.3,.06),(0,0,.93),wood,bw=.012)
    for i in range(3): pb(root,'drawer',(.9,.03,.6),(-1.0+i*1.0,-.61,.5),wood,bw=.012)
sh=empty('Shelf',(0,0,0)); build_shelf(sh)
ct=empty('Counter',(6.3,0,0)); build_counter(ct)
dk=empty('Desk',(11.4,0,0)); build_desk(dk)
# ---------- floor, camera, lights
fl=box('floor',(20,10,.05),(5.2,0,-.025),floor,bw=0)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); link(cam); cam.data.lens=30; cam.location=(5.6,-10.5,6.2)
tgt=Vector((5.6,-.2,.7)); d=tgt-cam.location; cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); sc.camera=cam
def area(name,loc,e,col,size):
    l=bpy.data.lights.new(name,'AREA'); l.energy=e; l.color=col; l.size=size; o=bpy.data.objects.new(name,l); link(o); o.location=loc
    dd=tgt-Vector(loc); o.rotation_euler=dd.to_track_quat('-Z','Y').to_euler()
area('key',(-1.5,-6,7),1500,(1,.78,.5),4); area('fill',(11,-6,5),500,(1,.6,.35),4); area('rim',(5,5,6),700,(1,.85,.65),4)
w=bpy.data.worlds.new('w'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs['Color'].default_value=(.28,.19,.11,1); w.node_tree.nodes['Background'].inputs['Strength'].default_value=.8; sc.world=w
import os
OUT=os.path.dirname(os.path.abspath(__file__))

import os
OUT=os.path.dirname(os.path.abspath(__file__))
if os.environ.get('BAKE')=='1':
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'
    dg=bpy.context.evaluated_depsgraph_get()
    wood_objs=[o for o in bpy.data.objects if o.type=='MESH' and any(ms.material and ms.material.name in('wood','woodd') for ms in o.material_slots)]
    print('wood objects',len(wood_objs))
    for o in wood_objs:                       # apply bevels so UVs/bake match the real shape
        me=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); old=o.data; o.modifiers.clear(); o.data=me
        if old.users==0: bpy.data.meshes.remove(old)
    bpy.ops.object.select_all(action='DESELECT')
    for o in wood_objs: o.select_set(True)
    bpy.context.view_layer.objects.active=wood_objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=0.004,area_weight=0.6)
    bpy.ops.uv.pack_islands(margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    SZB=int(os.environ.get('TEXSIZE','2048'))
    imgs={k:bpy.data.images.new('wood_'+k,SZB,SZB,alpha=False) for k in('albedo','rough','normal')}
    imgs['albedo'].colorspace_settings.name='sRGB'; imgs['rough'].colorspace_settings.name='Non-Color'; imgs['normal'].colorspace_settings.name='Non-Color'
    mats=[bpy.data.materials['wood'],bpy.data.materials['woodd']]
    tn={m.name:m.node_tree.nodes.new('ShaderNodeTexImage') for m in mats}
    sc.cycles.samples=6; sc.cycles.use_denoising=False
    def do_bake(kind,ptype,**kw):
        t=time.time()
        for m in mats: tn[m.name].image=imgs[kind]; m.node_tree.nodes.active=tn[m.name]
        bpy.ops.object.bake(type=ptype,margin=8,use_clear=True,**kw); print('bake',kind,round(time.time()-t,1))
    do_bake('albedo','DIFFUSE',pass_filter={'COLOR'}); do_bake('rough','ROUGHNESS'); do_bake('normal','NORMAL')
    for k,im in imgs.items():
        im.filepath_raw=os.path.join(OUT,'wood_%s.png'%k); im.file_format='PNG'; im.save(); im.pack()
    bm=bpy.data.materials.new('wood_baked'); bm.use_nodes=True; nt=bm.node_tree; b=nt.nodes['Principled BSDF']
    ta=nt.nodes.new('ShaderNodeTexImage'); ta.image=imgs['albedo']
    tr=nt.nodes.new('ShaderNodeTexImage'); tr.image=imgs['rough']
    tnn=nt.nodes.new('ShaderNodeTexImage'); tnn.image=imgs['normal']
    nmn=nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(ta.outputs['Color'],b.inputs['Base Color']); nt.links.new(tr.outputs['Color'],b.inputs['Roughness'])
    nt.links.new(tnn.outputs['Color'],nmn.inputs['Color']); nt.links.new(nmn.outputs['Normal'],b.inputs['Normal'])
    b.inputs['Metallic'].default_value=0.0
    for o in wood_objs:
        o.data.materials.clear(); o.data.materials.append(bm)
    # floor stays procedural for the render; swap its look so the check render is fair
    sc.cycles.samples=int(sys.argv[-1]) if sys.argv[-1].isdigit() else 40; sc.cycles.use_denoising=True
    sc.render.resolution_x=1400; sc.render.resolution_y=800; sc.render.image_settings.file_format='PNG'
    for name,lens,loc,tg in [('shop_baked.png',30,(5.6,-10.5,6.2),(5.6,-.2,.7)),('shelf_baked.png',38,(2.2,-4.6,3.3),(0,-.1,.75))]:
        cam.data.lens=lens; cam.location=loc; d=Vector(tg)-Vector(loc); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=os.path.join(OUT,name); t=time.time(); bpy.ops.render.render(write_still=True); print('render',name,round(time.time()-t,1))
    glb=os.path.join(OUT,'shop-furniture.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in('MESH','EMPTY') and o.name!='floor': o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=88)
    print('glb',os.path.getsize(glb)//1024,'KB'); raise SystemExit
# ---------- render
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(sys.argv[-1]) if sys.argv[-1].isdigit() else 40
try: sc.cycles.use_denoising=True; sc.cycles.denoiser='OPENIMAGEDENOISE'
except Exception as e: print('denoise',e)
sc.render.resolution_x=1400; sc.render.resolution_y=800; sc.render.image_settings.file_format='PNG'
sc.view_settings.view_transform='AgX' if 'AgX' in [v.identifier for v in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
sc.render.filepath=bpy.path.abspath('//rack.png')
import os
sc.render.filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)),'rack_close.png' if CLOSE else 'rack.png')
t1=time.time(); bpy.ops.render.render(write_still=True); print('render',round(time.time()-t1,1))
glb=os.path.join(os.path.dirname(os.path.abspath(__file__)),'rack.glb')
for o in list(bpy.data.objects):
    if o.type in('CAMERA','LIGHT') or o.name=='floor': o.select_set(False)
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=False)
print('glb',os.path.getsize(glb)//1024,'KB','total',round(time.time()-t0,1))

