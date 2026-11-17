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

# =====================================================================
# Wood v6: board-by-board variation, bent grain, fibres, knots, pores
# =====================================================================
def wood_mat(name,c1,c2,scale=5):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; b=N['Principled BSDF']
    def node(t,**kw):
        n=N.new(t)
        for k,v in kw.items(): setattr(n,k,v)
        return n
    def mapping(vec,scale):
        mp=node('ShaderNodeMapping'); mp.inputs['Scale'].default_value=scale; L.new(vec,mp.inputs['Vector']); return mp.outputs[0]
    tc0=node('ShaderNodeTexCoord'); oi=node('ShaderNodeObjectInfo')
    cx=node('ShaderNodeCombineXYZ')
    for i,k in enumerate((41.0,67.0,53.0)):
        mm=node('ShaderNodeMath',operation='MULTIPLY'); mm.inputs[1].default_value=k; L.new(oi.outputs['Random'],mm.inputs[0]); L.new(mm.outputs[0],cx.inputs[i])
    co=node('ShaderNodeVectorMath',operation='ADD'); L.new(tc0.outputs['Object'],co.inputs[0]); L.new(cx.outputs[0],co.inputs[1])
    # bend the grain with low-frequency noise
    nw=node('ShaderNodeTexNoise'); nw.inputs['Scale'].default_value=1.3; nw.inputs['Detail'].default_value=2; L.new(mapping(co.outputs[0],(.3,2.5,2.5)),nw.inputs['Vector'])
    sub=node('ShaderNodeVectorMath',operation='SUBTRACT'); sub.inputs[1].default_value=(.5,.5,.5); L.new(nw.outputs['Color'],sub.inputs[0])
    sc_=node('ShaderNodeVectorMath',operation='SCALE'); sc_.inputs['Scale'].default_value=.035; L.new(sub.outputs[0],sc_.inputs[0])
    cw=node('ShaderNodeVectorMath',operation='ADD'); L.new(co.outputs[0],cw.inputs[0]); L.new(sc_.outputs[0],cw.inputs[1])
    # rings: scale and distortion differ per board
    wv=node('ShaderNodeTexWave',wave_type='RINGS',rings_direction='X',wave_profile='SIN')
    rs=node('ShaderNodeMapRange'); rs.inputs['To Min'].default_value=11; rs.inputs['To Max'].default_value=30; L.new(oi.outputs['Random'],rs.inputs['Value']); L.new(rs.outputs['Result'],wv.inputs['Scale'])
    rd=node('ShaderNodeMapRange'); rd.inputs['To Min'].default_value=.3; rd.inputs['To Max'].default_value=1.3; L.new(oi.outputs['Random'],rd.inputs['Value'])
    rdi=node('ShaderNodeMath',operation='SUBTRACT'); rdi.inputs[0].default_value=1.8; L.new(rd.outputs['Result'],rdi.inputs[1]); L.new(rdi.outputs[0],wv.inputs['Distortion'])
    wv.inputs['Detail'].default_value=0; L.new(cw.outputs[0],wv.inputs['Vector'])
    # fibres along the grain
    nf=node('ShaderNodeTexNoise'); nf.inputs['Scale'].default_value=1.0; nf.inputs['Detail'].default_value=8; nf.inputs['Roughness'].default_value=.66; L.new(mapping(cw.outputs[0],(.12,75,75)),nf.inputs['Vector'])
    # broad tone drift
    nb=node('ShaderNodeTexNoise'); nb.inputs['Scale'].default_value=1.4; nb.inputs['Detail'].default_value=3; L.new(mapping(co.outputs[0],(.2,2.5,2.5)),nb.inputs['Vector'])
    # knots: rare dark eyes, elongated along the grain
    vo=node('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value=1.0; L.new(mapping(co.outputs[0],(1.1,4.5,4.5)),vo.inputs['Vector'])
    kd=node('ShaderNodeMapRange'); kd.inputs['From Min'].default_value=0; kd.inputs['From Max'].default_value=.13; kd.inputs['To Min'].default_value=1; kd.inputs['To Max'].default_value=0; L.new(vo.outputs['Distance'],kd.inputs['Value'])
    spc=node('ShaderNodeSeparateColor'); L.new(vo.outputs['Color'],spc.inputs['Color'])
    kg=node('ShaderNodeMath',operation='GREATER_THAN'); kg.inputs[1].default_value=.86; L.new(spc.outputs['Red'],kg.inputs[0])
    knot=node('ShaderNodeMath',operation='MULTIPLY'); L.new(kd.outputs['Result'],knot.inputs[0]); L.new(kg.outputs[0],knot.inputs[1])
    # combine
    m1=node('ShaderNodeMix',data_type='FLOAT'); m1.inputs[0].default_value=.72; L.new(wv.outputs['Fac'],m1.inputs[2]); L.new(nf.outputs['Fac'],m1.inputs[3])
    m2=node('ShaderNodeMix',data_type='FLOAT'); m2.inputs[0].default_value=.22; L.new(m1.outputs[0],m2.inputs[2]); L.new(nb.outputs['Fac'],m2.inputs[3])
    cr=node('ShaderNodeValToRGB'); cr.color_ramp.interpolation='B_SPLINE'
    cr.color_ramp.elements[0].position=0; cr.color_ramp.elements[0].color=tuple(x*.30 for x in c1)+(1,)
    e=cr.color_ramp.elements.new(.36); e.color=(*c1,1)
    e=cr.color_ramp.elements.new(.66); e.color=(*c2,1)
    cr.color_ramp.elements[-1].position=1; cr.color_ramp.elements[-1].color=tuple(min(1,x*2.3) for x in c2)+(1,)
    L.new(m2.outputs[0],cr.inputs['Fac'])
    # per-board tint (some boards warmer, some darker)
    tr=node('ShaderNodeValToRGB'); tr.color_ramp.elements[0].color=(.74,.72,.70,1); tr.color_ramp.elements[1].color=(1.18,1.06,.94,1)
    oi2=node('ShaderNodeMath',operation='FRACT'); m7=node('ShaderNodeMath',operation='MULTIPLY'); m7.inputs[1].default_value=7.31
    L.new(oi.outputs['Random'],m7.inputs[0]); L.new(m7.outputs[0],oi2.inputs[0]); L.new(oi2.outputs[0],tr.inputs['Fac'])
    tint=node('ShaderNodeMix',data_type='RGBA',blend_type='MULTIPLY'); tint.inputs[0].default_value=1; L.new(cr.outputs['Color'],tint.inputs[6]); L.new(tr.outputs['Color'],tint.inputs[7])
    # knots darken
    kc=node('ShaderNodeMix',data_type='RGBA',blend_type='MIX'); kc.inputs[7].default_value=tuple(x*.22 for x in c1)+(1,)
    kf=node('ShaderNodeMath',operation='MULTIPLY'); kf.inputs[1].default_value=.9; L.new(knot.outputs[0],kf.inputs[0]); L.new(kf.outputs[0],kc.inputs[0]); L.new(tint.outputs[2],kc.inputs[6])
    # pores
    npor=node('ShaderNodeTexNoise'); npor.inputs['Scale'].default_value=1; npor.inputs['Detail'].default_value=2; L.new(mapping(cw.outputs[0],(1.4,700,700)),npor.inputs['Vector'])
    pr=node('ShaderNodeValToRGB'); pr.color_ramp.elements[0].position=.58; pr.color_ramp.elements[1].position=.66; pr.color_ramp.elements[0].color=(1,1,1,1); pr.color_ramp.elements[1].color=(.15,.12,.12,1); L.new(npor.outputs['Fac'],pr.inputs['Fac'])
    pm=node('ShaderNodeMix',data_type='RGBA',blend_type='MULTIPLY'); pm.inputs[0].default_value=1; L.new(kc.outputs[2],pm.inputs[6]); L.new(pr.outputs['Color'],pm.inputs[7])
    # edge wear
    bv=node('ShaderNodeBevel'); bv.inputs['Radius'].default_value=.008; ng=node('ShaderNodeNewGeometry')
    dt=node('ShaderNodeVectorMath',operation='DOT_PRODUCT'); L.new(bv.outputs['Normal'],dt.inputs[0]); L.new(ng.outputs['Normal'],dt.inputs[1])
    em=node('ShaderNodeMapRange'); em.inputs['From Min'].default_value=.985; em.inputs['From Max'].default_value=.9; L.new(dt.outputs['Value'],em.inputs['Value'])
    nwr=node('ShaderNodeTexNoise'); nwr.inputs['Scale'].default_value=60; nwr.inputs['Detail'].default_value=4
    ew=node('ShaderNodeMath',operation='MULTIPLY'); L.new(nwr.outputs['Fac'],ew.inputs[0]); L.new(em.outputs['Result'],ew.inputs[1])
    wc=node('ShaderNodeMix',data_type='RGBA',blend_type='MIX'); wc.inputs[7].default_value=tuple(min(1,x*3.0) for x in c2)+(1,)
    L.new(ew.outputs[0],wc.inputs[0]); L.new(pm.outputs[2],wc.inputs[6]); L.new(wc.outputs[2],b.inputs['Base Color'])
    # roughness
    rr=node('ShaderNodeMapRange'); rr.inputs['To Min'].default_value=.86; rr.inputs['To Max'].default_value=.6; L.new(m2.outputs[0],rr.inputs['Value'])
    ra=node('ShaderNodeMath',operation='ADD',use_clamp=True); L.new(rr.outputs['Result'],ra.inputs[0]); L.new(knot.outputs[0],ra.inputs[1]); L.new(ra.outputs[0],b.inputs['Roughness'])
    # bump
    bh=node('ShaderNodeMath',operation='ADD'); L.new(m1.outputs[0],bh.inputs[0]); L.new(knot.outputs[0],bh.inputs[1])
    bump=node('ShaderNodeBump'); bump.inputs['Strength'].default_value=.24; bump.inputs['Distance'].default_value=.0015
    L.new(bh.outputs[0],bump.inputs['Height']); L.new(bv.outputs['Normal'],bump.inputs['Normal']); L.new(bump.outputs['Normal'],b.inputs['Normal'])
    for k,v in (('Coat Weight',0.0),('Specular IOR Level',.22)):
        try: b.inputs[k].default_value=v
        except Exception as ex: print('input',k,ex)
    return m

def lin(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    return [x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c]
BASE=lin('#3F2000')
wood=wood_mat('wood',tuple(x*.7 for x in BASE),tuple(x*1.35 for x in BASE))
woodd=wood_mat('woodd',tuple(x*.5 for x in BASE),tuple(x*.95 for x in BASE))
floor=wood_mat('floor',tuple(x*.9 for x in BASE),tuple(x*1.8 for x in BASE))
pink=mat_principled('pinkmetal',(.95,.5,.65),.36,1.0); gold=mat_principled('goldmetal',(1.0,.72,.22),.38,1.0)
clear=mat_principled('clearblue',(.55,.8,1.0),.04,0.0,1.0)
_nt=clear.node_tree; _va=_nt.nodes.new('ShaderNodeVolumeAbsorption'); _va.inputs['Color'].default_value=(.15,.5,1.0,1); _va.inputs['Density'].default_value=24
_nt.links.new(_va.outputs['Volume'],_nt.nodes['Material Output'].inputs['Volume'])
teal=mat_principled('tealplastic',(.05,.5,.42),.45); ruby=mat_principled('rubygem',(.6,.02,.08),.08,0.0,1.0)
inkD=mat_principled('inkdark',(.12,.02,.05),.45); inkL=mat_principled('inkwhite',(.95,.93,.88),.45)

# =====================================================================
# Furniture. Blender: z up, front = -y. glTF/three: y up, front = +z.
# =====================================================================
def empty(name,loc=(0,0,0),parent=None,rot=(0,0,0)):
    e=bpy.data.objects.new(name,None); link(e); e.location=loc; e.rotation_euler=rot; e.empty_display_size=.05
    if parent: e.parent=parent
    return e
def pb(par,name,size,loc,m,rot=(0,0,0),bw=.004):
    o=box(name,size,loc,m,rot=rot,bw=bw); o.parent=par; return o
def planks(par,name,size,loc,m,axis,rot=(0,0,0),wmin=.09,wmax=.19,gap=.003,bw=.004):
    Lx=size[axis]; n=max(1,round(Lx/((wmin+wmax)/2))); ws=[random.uniform(wmin,wmax) for _ in range(n)]; s=sum(ws); ws=[w*Lx/s for w in ws]
    Rm=Euler(rot).to_matrix(); pos=-Lx/2
    for w in ws:
        sz=list(size); sz[axis]=max(.005,w-gap); off=[0,0,0]; off[axis]=pos+w/2; o=Rm@Vector(off)
        pb(par,name,tuple(sz),(loc[0]+o.x,loc[1]+o.y,loc[2]+o.z),m,rot=rot,bw=bw); pos+=w
def profile_panel(par,name,pts,plane,offset,thick,m):
    """pts: 2D polygon. plane 'yz' (extrude along x) or 'xz' (extrude along y)."""
    bm=bmesh.new()
    vs=[bm.verts.new((offset,a,b2) if plane=='yz' else (a,offset,b2)) for a,b2 in pts]
    f=bm.faces.new(vs); r=bmesh.ops.extrude_face_region(bm,geom=[f])
    for v in [e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]:
        if plane=='yz': v.co.x+=thick
        else: v.co.y+=thick
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); link(o); o.data.materials.append(m); o.parent=par; return o
SLOTS=[]
def slot(par,loc,rot,ex,ey):
    e=empty('slot_%03d'%len(SLOTS),loc,par,rot); e['ex']=ex; e['ey']=ey; SLOTS.append(e); return e

H0,DH,TD,NT,TILT=.6,.24,.2,5,.08   # first tier height, tier step, tier depth, tiers, tray tilt
def build_island(root):
    LW,NC=2.0,5
    top=H0+(NT-1)*DH; spine_h=top+.34
    for sign in(-1,1):                       # S side (-y) and N side (+y)
        rx=-sign*TILT
        for i in range(NT):
            yc=sign*(.05+(NT-i-.5)*TD); h=H0+i*DH; yo=yc+sign*TD/2
            pb(root,'slab',(LW,TD,.04),(0,yc,h),wood,rot=(rx,0,0))
            pb(root,'lip',(LW,.025,.075),(0,yo,h+.03),wood)
            lo=0 if i==0 else h-DH
            planks(root,'riser',(LW,.025,h-lo),(0,yo+sign*.0125,(h+lo)/2-.01),woodd,2,wmin=.12,wmax=.2)
            for k in range(1,NC): pb(root,'div',(.022,TD,.085),(-LW/2+k*LW/NC,yc,h+.04),wood,rot=(rx,0,0))
            for c in range(NC): slot(root,(-LW/2+(c+.5)*LW/NC,yc,h+.025),(rx,0,0),LW/NC,TD)
    planks(root,'spine',(LW,.1,spine_h),(0,0,spine_h/2),woodd,2,wmin=.14,wmax=.24)
    pb(root,'cap',(LW+.08,.18,.045),(0,0,spine_h+.022),wood,bw=.006)
    # stepped side panels closing both long sides
    pts=[(-1.05,0)]
    for i in range(NT):
        yo=-(.05+(NT-i)*TD); z=H0+i*DH+.1; pts+=[(yo,z),(yo+TD,z)]
    pts+=[(-.05,spine_h),(.05,spine_h)]
    for i in reversed(range(NT)):
        yo=(.05+(NT-i)*TD); z=H0+i*DH+.1; pts+=[(yo-TD,z),(yo,z)]
    pts+=[(1.05,0)]
    for sx in(-1,1): profile_panel(root,'sidepanel',pts,'yz',sx*(LW/2+.03)-(.03 if sx>0 else 0)+(0 if sx>0 else 0),.03,woodd)
    # short ends: 2 tiers x 4 columns
    EW,EC=2.1,4
    for sx in(-1,1):
        ry=sx*TILT
        for j in range(2):
            xc=sx*(LW/2+.03+(2-j-.5)*TD); h=H0+j*DH; xo=xc+sx*TD/2
            pb(root,'eslab',(TD,EW,.04),(xc,0,h),wood,rot=(0,ry,0))
            pb(root,'elip',(.025,EW,.075),(xo,0,h+.03),wood)
            lo=0 if j==0 else h-DH
            planks(root,'eriser',(.025,EW,h-lo),(xo+sx*.0125,0,(h+lo)/2-.01),woodd,2,wmin=.12,wmax=.2)
            for k in range(1,EC): pb(root,'ediv',(TD,.022,.085),(xc,-EW/2+k*EW/EC,h+.04),wood,rot=(0,ry,0))
            for c in range(EC): slot(root,(xc,-EW/2+(c+.5)*EW/EC,h+.025),(0,ry,0),TD,EW/EC)
        x0=LW/2+.03; e_pts=[(x0,0),(x0+2*TD,0),(x0+2*TD,H0+.1),(x0+TD,H0+.1),(x0+TD,H0+DH+.1),(x0,H0+DH+.1)]
        if sx<0: e_pts=[(-a,b2) for a,b2 in e_pts][::-1]
        for sy in(-1,1): profile_panel(root,'endpanel',e_pts,'xz',sy*(EW/2)+(0 if sy>0 else -.03),.03,woodd)
def build_wallrack(root,ncols):
    W=ncols*.4; NTW=4; H0W=.72
    planks(root,'back',(W+.06,.025,1.9),(0,-.0125,.95),woodd,2,wmin=.14,wmax=.24)
    pb(root,'cap',(W+.1,.12,.04),(0,-.05,1.92),wood,bw=.006)
    for j in range(NTW):
        yc=-(.8-(j+.5)*TD); h=H0W+j*DH; yo=yc-TD/2
        pb(root,'slab',(W,TD,.04),(0,yc,h),wood,rot=(TILT,0,0))
        pb(root,'lip',(W,.025,.075),(0,yo,h+.03),wood)
        lo=0 if j==0 else h-DH
        planks(root,'riser',(W,.025,h-lo),(0,yo-.0125,(h+lo)/2-.01),woodd,0,wmin=.5,wmax=1.0) if j==0 else planks(root,'riser',(W,.025,h-lo),(0,yo-.0125,(h+lo)/2-.01),woodd,2,wmin=.12,wmax=.2)
        for k in range(1,ncols): pb(root,'div',(.022,TD,.085),(-W/2+k*.4,yc,h+.04),wood,rot=(TILT,0,0))
        for c in range(ncols): slot(root,(-W/2+(c+.5)*.4,yc,h+.025),(TILT,0,0),.4,TD)
    pts=[(-.8,0)]
    for j in range(NTW):
        yo=-(.8-j*TD); z=H0W+j*DH+.1; pts+=[(yo,z),(yo+TD,z)]
    pts[-1]=(-.03,pts[-1][1]); pts+=[(-.03,1.9),(0,1.9),(0,0)]
    for sx in(-1,1): profile_panel(root,'sidepanel',pts,'yz',sx*(W/2+.03)-(.03 if sx>0 else 0),.03,woodd)
def build_counter(root):
    pb(root,'body',(6.0,.92,1.05),(0,0,.525),woodd,bw=.01)
    planks(root,'top',(6.12,1.04,.07),(0,0,1.085),wood,1,wmin=.14,wmax=.22,bw=.008)
    pb(root,'kick',(6.0,.06,.1),(0,-.49,.05),woodd,bw=.006)
    for i in range(6): planks(root,'panel',(.88,.03,.68),(-2.5+i,-.47,.55),wood,0,wmin=.12,wmax=.22,bw=.006)
    pb(root,'ret',(1.0,1.4,1.05),(-2.5,-1.0,.525),woodd,bw=.01)
    planks(root,'rettop',(1.12,1.52,.07),(-2.5,-1.0,1.087),wood,0,wmin=.14,wmax=.22,bw=.008)
    planks(root,'retpanel',(.8,.03,.68),(-2.5,-1.72,.55),wood,0,wmin=.12,wmax=.22,bw=.006)
def build_desk(root):
    pb(root,'body',(3.2,1.2,.9),(0,0,.45),woodd,bw=.01)
    planks(root,'top',(3.3,1.3,.06),(0,0,.93),wood,1,wmin=.14,wmax=.22,bw=.008)
    for i in range(3): pb(root,'drawer',(.9,.03,.6),(-1.0+i*1.0,-.61,.5),wood,bw=.01)

isl=empty('Island',(0,0,0)); build_island(isl)
n_island=len(SLOTS)
w7=empty('WallRack7',(4.3,.4,0)); build_wallrack(w7,7)
w11=empty('WallRack11',(-5.8,.4,0)); build_wallrack(w11,11)
ct=empty('Counter',(0,-6.5,0)); build_counter(ct)
dk=empty('Desk',(7.5,-6.5,0)); build_desk(dk)
print('slots: island',n_island,'x5 =',n_island*5,'| wall',len(SLOTS)-n_island,'| total',n_island*5+len(SLOTS)-n_island)
bpy.context.view_layer.update()

# preview dice in a few island slots (not exported)
def place_set_at(e,body,ink):
    T=e.matrix_world.copy(); ex,ey=e['ex'],e['ey']; pos=[]; tries=0
    while len(pos)<7 and tries<3000:
        tries+=1; px=random.uniform(-ex/2+.04,ex/2-.04); py=random.uniform(-ey/2+.035,ey/2-.035)
        if all((px-a)**2+(py-b2)**2>.062**2 for a,b2 in pos): pos.append((px,py))
    while len(pos)<7: pos.append((random.uniform(-ex/2+.04,ex/2-.04),random.uniform(-ey/2+.035,ey/2-.035)))
    for kind,(px,py) in zip([4,6,8,10,100,12,20],pos):
        r=.03; d=make_die(kind,body,ink,r); d['preview']=1; s_=r*SZ[kind]
        c,n=random.choice(d['faces']); n=Vector(n); c=Vector(c)
        Rm=n.rotation_difference(Vector((0,0,-1))).to_matrix().to_4x4(); dist=c.dot(n)
        d.matrix_world=T@Matrix.Translation((px,py,dist*s_+.002))@Matrix.Rotation(random.uniform(0,6.283),4,'Z')@Rm@Matrix.Diagonal((s_,s_,s_,1))
mats=[(pink,inkD),(gold,inkD),(clear,inkL),(teal,inkL),(ruby,inkL)]
for k,e in enumerate(SLOTS[:n_island]):
    if e.location.y<0 and random.random()<.45: place_set_at(e,*mats[k%len(mats)])

fl=box('floor',(30,20,.05),(0,-3,-.025),floor,bw=0)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); link(cam); sc.camera=cam
tgt=Vector((0,0,.9))
def area(name,loc,e,col,size):
    l=bpy.data.lights.new(name,'AREA'); l.energy=e; l.color=col; l.size=size; o=bpy.data.objects.new(name,l); link(o); o.location=loc
    dd=tgt-Vector(loc); o.rotation_euler=dd.to_track_quat('-Z','Y').to_euler()
area('key',(-2.5,-4,4.5),700,(1,.78,.5),3); area('ckey',(-1.5,-9.5,3.5),600,(1,.8,.55),3); area('fill',(3.5,-3.5,2.5),220,(1,.6,.35),3); area('rim',(0,4,4),300,(1,.85,.65),3)
w=bpy.data.worlds.new('w'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs['Color'].default_value=(.28,.19,.11,1); w.node_tree.nodes['Background'].inputs['Strength'].default_value=.6; sc.world=w
import os
OUT=os.path.dirname(os.path.abspath(__file__))
sc.render.engine='CYCLES'; sc.cycles.device='CPU'
ONLY=os.environ.get('ONLY')
VIEWS=[('island.png',36,(2.7,-3.9,2.75),(0,-.25,.85)),('wallrack.png',36,(4.9,-2.6,2.1),(4.3,-.1,1.0)),('counter.png',32,(1.5,-11.8,3.4),(1.0,-6.5,.6))]
def render_views(prefix=''):
    sc.cycles.samples=int(os.environ.get('SAMPLES','28')); sc.cycles.use_denoising=True
    sc.render.resolution_x=1400; sc.render.resolution_y=800; sc.render.image_settings.file_format='PNG'
    for name,lens,loc,tg in [v for v in VIEWS if not ONLY or v[0]==ONLY]:
        cam.data.lens=lens; cam.location=loc; d=Vector(tg)-Vector(loc); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=os.path.join(OUT,prefix+name); t=time.time(); bpy.ops.render.render(write_still=True); print('render',prefix+name,round(time.time()-t,1))
if os.environ.get('BAKE')!='1':
    render_views('proc_'); raise SystemExit
# ---------------- bake all wood into one atlas ----------------
dg=bpy.context.evaluated_depsgraph_get()
wood_objs=[o for o in bpy.data.objects if o.type=='MESH' and any(ms.material and ms.material.name in('wood','woodd') for ms in o.material_slots)]
print('wood objects',len(wood_objs))
for o in wood_objs:
    me=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); old=o.data; o.modifiers.clear(); o.data=me
    if old.users==0: bpy.data.meshes.remove(old)
bpy.ops.object.select_all(action='DESELECT')
for o in wood_objs: o.select_set(True)
bpy.context.view_layer.objects.active=wood_objs[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=0.002,area_weight=0.6)
bpy.ops.uv.pack_islands(margin=0.002)
bpy.ops.object.mode_set(mode='OBJECT')
SZB=int(os.environ.get('TEXSIZE','2048'))
imgs={k:bpy.data.images.new('wood_'+k,SZB,SZB,alpha=False) for k in('albedo','rough','normal')}
imgs['albedo'].colorspace_settings.name='sRGB'; imgs['rough'].colorspace_settings.name='Non-Color'; imgs['normal'].colorspace_settings.name='Non-Color'
wm=[wood,woodd]; tn={m.name:m.node_tree.nodes.new('ShaderNodeTexImage') for m in wm}
sc.cycles.samples=6; sc.cycles.use_denoising=False
for kind,ptype,kw in (('albedo','DIFFUSE',{'pass_filter':{'COLOR'}}),('rough','ROUGHNESS',{}),('normal','NORMAL',{})):
    t=time.time()
    for m in wm: tn[m.name].image=imgs[kind]; m.node_tree.nodes.active=tn[m.name]
    bpy.ops.object.bake(type=ptype,margin=6,use_clear=True,**kw); print('bake',kind,round(time.time()-t,1))
for k,im in imgs.items():
    im.filepath_raw=os.path.join(OUT,'wood_%s.png'%k); im.file_format='PNG'; im.save(); im.pack()
bmat=bpy.data.materials.new('wood_baked'); bmat.use_nodes=True; nt=bmat.node_tree; b=nt.nodes['Principled BSDF']
ta=nt.nodes.new('ShaderNodeTexImage'); ta.image=imgs['albedo']; trr=nt.nodes.new('ShaderNodeTexImage'); trr.image=imgs['rough']
tnn=nt.nodes.new('ShaderNodeTexImage'); tnn.image=imgs['normal']; nmn=nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(ta.outputs['Color'],b.inputs['Base Color']); nt.links.new(trr.outputs['Color'],b.inputs['Roughness'])
nt.links.new(tnn.outputs['Color'],nmn.inputs['Color']); nt.links.new(nmn.outputs['Normal'],b.inputs['Normal'])
for o in wood_objs: o.data.materials.clear(); o.data.materials.append(bmat)
render_views('baked_')
glb=os.path.join(OUT,'shop-furniture.glb')
bpy.ops.object.select_all(action='DESELECT')
def is_preview(o):
    while o is not None:
        if o.get('preview'): return True
        o=o.parent
    return False
for o in bpy.data.objects:
    if o.type in('MESH','EMPTY') and o.name!='floor' and not is_preview(o): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_extras=True,export_image_format='JPEG',export_jpeg_quality=88)
print('glb',os.path.getsize(glb)//1024,'KB')
