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


import os
NUM.clear()
def numeral_mesh(label):
    if label in NUM: return NUM[label]
    cu=bpy.data.curves.new('t'+label,'FONT'); cu.body=label; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=1.0; cu.extrude=0.0; cu.resolution_u=2
    o=bpy.data.objects.new('t'+label,cu); link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); me=o.data
    w=max(v.co.x for v in me.vertices)-min(v.co.x for v in me.vertices)
    bpy.data.objects.remove(o,do_unlink=True); NUM[label]=(me,w); return NUM[label]
_bev=bevel
def bevel(o,w=.006,seg=2): return _bev(o,w,1)
body=mat_principled('body',(1,1,1),.4); ink=mat_principled('ink',(.1,.05,.05),.5)
OUT=os.path.dirname(os.path.abspath(__file__))
names={4:'d4',6:'d6',8:'d8',10:'d10',100:'d100',12:'d12',20:'d20'}
x=0
for kind in (4,6,8,10,100,12,20):
    o=make_die(kind,body,ink,.03)
    o.location=(x,0,0); x+=.1
    bpy.context.view_layer.update()
    for c in list(o.children):
        c.data=c.data.copy(); mw=c.matrix_world.copy(); c.parent=None; c.matrix_world=mw
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='bev')
    kids=[c for c in bpy.data.objects if c.type=='MESH' and c is not o and c.name.startswith('n') and (c.matrix_world.translation-o.matrix_world.translation).length<.06]
    for c in kids: c.select_set(True)
    bpy.ops.object.join()
    o.name=names[kind]; o.data.name=names[kind]
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for o in list(bpy.data.objects):
    if o.name.startswith('n') and o.parent is None and o.type=='MESH' and o.name not in names.values(): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='SELECT')
glb=os.path.join(OUT,'dice.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True)
for o in bpy.data.objects: print(o.name,len(o.data.polygons),[m.name for m in o.data.materials])
print('glb',os.path.getsize(glb)//1024,'KB')
