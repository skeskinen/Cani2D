requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
//Current library version and all previous versions that had same model format
CANI2D = {version: [0,0,1], compatible_versions:[]};

/*
* Function to clear given canvas.
* http://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
*/

CANI2D.clear = function( ctx ){
		// Store the current transformation matrix
		ctx.save();

		// Use the identity matrix while clearing the canvas
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Restore the transform
		ctx.restore();
}

/*
*	Face class. Face contains the information required to draw one triangle.
*	This includes vertex indices, face's personal texture buffer canvas, uv
*	coordinates and face z.
*	Parameter are kinda cryptic so here goes.
*	@param face triad or quad from geometry
*	@param uv_index uv coordinate index of the first corner
*	@param corners indices of the three corners that make up this face [0,4]
*			since faces in the model data can be quad but Face can't
*	@param overdraw how many pixels why should expand the textures
*	uv_index means
*/

CANI2D.Face = function(geometry, texture, face, uv_index, corners, overdraw){
	this.geometry = geometry;
	
	// Vertice indices, int array.
	this.vertices = [];
	
	// UV coordinates, 2 doubles per vertex.
	this.uv = [];
	
	// draw order z
	this.z = face.z;
	
	// create texture buffer
	this.canvas = document.createElement( 'canvas' );
	this.ctx = this.canvas.getContext( '2d' );

	// texture (buffer) size in texture coordinates [0,1]
	this.w = this.h = 0.0;
	
	var uv = geometry.uv;


	/*
	*	Calculate face texture bounds. These are used to make fitting
	*	buffer for the face.
	*	min_x and min_y are also tell us where the texture starts and
	*	are used as offset.
	*/
	
	var min_x = 1.0, max_x = 0.0, min_y = 1.0, max_y = 0.0;
	for(var i = 0; i < 3; i++){
		min_x = Math.min( min_x, uv[ (uv_index + corners[ i ])*2 ] );
		max_x = Math.max( max_x, uv[ (uv_index + corners[ i ])*2 ] );
		min_y = Math.min( min_y, uv[ (uv_index + corners[ i ])*2+1 ] );
		max_y = Math.max( max_y, uv[ (uv_index + corners[ i ])*2+1 ] );
	}
	

	var t_w = texture.width, t_h = texture.height;
	
	/*
	*	Make the buffer n*2 pixels larger so we can buffer n additional pixel(s)
	*	in each direction. This is to hide gaps between faces.
	*/
	min_x -= overdraw / t_w;
	min_y -= overdraw / t_h;
	max_x += overdraw / t_w;
	max_y += overdraw / t_h;
	
	// calculate buffer size
	this.w = max_x - min_x, this.h = max_y - min_y;
	
	// buffer size = texture coordinate size * texture size. Ceil to neares full pixel.
	var buffer_w = Math.ceil( this.w * t_w );
	var buffer_h = Math.ceil( this.h * t_h );
	
	// ceiling changes buffer size so need to recalculate this
	this.w = buffer_w / t_w, this.h = buffer_h / t_h;
	
	var canvas = this.canvas;
	
	canvas.width = buffer_w;
	canvas.height = buffer_h;
	
	// draw the texture to buffer
	this.buffer( texture, uv_index + corners[ 0 ], uv_index + corners[ 1 ], uv_index + corners[ 2 ], min_x, min_y, overdraw );
	
	//save offsetted texture coordinates and vertex indices
	for( var i = 0; i < 3; i++ ){
		this.uv.push( geometry.uv[ (uv_index + corners[ i ]) * 2 ] - min_x );
		this.uv.push( geometry.uv[ (uv_index + corners[ i ]) * 2 + 1 ] - min_y );
		this.vertices.push( face.vertices[ corners[ i ] ] );
	}
}	

/*
*	Function that draws the correct part of the whole texture into face's own buffer.
*/

CANI2D.Face.prototype.buffer = function( texture, uv0, uv1, uv2, offset_x, offset_y, overdraw ){
	var uv = this.geometry.uv;
	//texture coordinates
	var v0 = { s: uv[ uv0*2 ], t: uv[ uv0*2+1 ] };
	var v1 = { s: uv[ uv1*2 ], t: uv[ uv1*2+1 ] };
	var v2 = { s: uv[ uv2*2 ], t: uv[ uv2*2+1 ] };
	
	
	var w = texture.width, h = texture.height;
	
	/*
	*	Function to push each point aprox. n pixel farther from eachother.
	*	Used to expand the buffered texture.
	*	This hides the gaps between faces, since every face is actually drawn
	*	n pixel larger than it "should" be.
	*	three.js canvas renderer used as reference.
	*/
	
	function expand( a, b ) {
		var x = b.s - a.s, y = b.t - a.t,
		det = x * x + y * y, idet;

		if ( det === 0 ) return;

		idet = 1 / Math.sqrt( det );

		x *= idet / w * overdraw; y *= idet / h * overdraw;

		b.s += x; b.t += y;
		a.s -= x; a.t -= y;
	}
	
	//Expand texture. The stored texture coordinates are not affected.		
	expand( v0, v1);
	expand( v1, v2);
	expand( v2, v0);
	
	var ctx = this.ctx;
	ctx.save();
	/*
	*	Scale w,h and translate -w*offset_x, -h*offset_y.
	*	With this texture is not scaled and drawn inside buffer bounds.
	*/
	ctx.setTransform( w, 0, 0, h, -w*offset_x, -h*offset_y );
	
	/*
	*	Create the path and clip to it. This operation is SLUGGISH.
	*	This is the main reason why textures are buffered per face.
	*/
	ctx.beginPath(); ctx.moveTo( v0.s, v0.t ); ctx.lineTo( v1.s, v1.t );
	ctx.lineTo( v2.s, v2.t ); ctx.closePath(); ctx.clip();

	ctx.drawImage( texture, 0, 0, 1, 1 );
	ctx.restore();
}

/*
* The function that actually does all the drawing. 
* vertices is array of vertex coordinates from which coordinates are picked 
* acording to stored vertex indices.
*/

CANI2D.Face.prototype.draw = function(output, vertices){
	var uv = this.uv;
	var v = this.vertices;
	var x0 = vertices[ v[0] * 2 ], x1 = vertices[ v[1] * 2 ], x2 = vertices[ v[2] * 2 ];
	var y0 = vertices[ v[0] * 2 + 1 ], y1 = vertices[ v[1] * 2 + 1 ], y2 = vertices[ v[2] * 2 + 1 ];
	
	var s0 = uv[ 0 ], s1 = uv[ 2 ], s2 = uv[ 4 ];
	var t0 = uv[ 1 ], t1 = uv[ 3 ], t2 = uv[ 5 ];
	
	/*
	*	Calculate texture mapping transform matrix.
	*	Reference: http://stackoverflow.com/questions/4774172/image-manipulation-and-texture-mapping-using-html5-canvas
	*/
	
	var delta = s0*t1 + t0*s2 + s1*t2 - t1*s2 - t0*s1 - s0*t2;
	var a = (x0*t1 + t0*x2 + x1*t2 - t1*x2 - t0*x1 - x0*t2)/delta;
	var b = (s0*x1 + x0*s2 + s1*x2 - x1*s2 - x0*s1 - s0*x2)/delta;
	var c = (s0*t1*x2 + t0*x1*s2 + x0*s1*t2 - x0*t1*s2
				  - t0*s1*x2 - s0*x1*t2)/delta;
	var d = (y0*t1 + t0*y2 + y1*t2 - t1*y2 - t0*y1 - y0*t2)/delta;
	var e = (s0*y1 + y0*s2 + s1*y2 - y1*s2 - y0*s1 - s0*y2)/delta;
	var f = (s0*t1*y2 + t0*y1*s2 + y0*s1*t2 - y0*t1*s2
				  - t0*s1*y2 - s0*y1*t2)/delta;
	
	output.save();
	//set the transform that we just calculated
	output.transform( a, d, b, e, c, f );
	/* 
	* draw the triangle from the buffer, w and h are buffer size relative to
	* the size of the whole texture [0,1]
	*/
	output.drawImage( this.canvas, 0, 0, this.w, this.h );

	//revert transform
	output.restore();
}

/*
*	Class mesh combines geometry and texture into something we can draw.
*/

CANI2D.Mesh = function(geometry, texture, overdraw){
	this.geometry = geometry;

	//compare geometry and library version
	this.version_check();

	this.faces = [];
	
	/*
	* Array to store sum of vertex group weights for every vertex.
	* This is potentially kinda stupid since this information isn't used for 
	* anything else but to check that weight is not zero. Blender should do the
	* normalization...
	*/
	this.total_weights = new Array( this.geometry.vertices.length );
	this.calc_vertex_weights();

	//texture overdraw, passed to face, optional argument, default value 1
	if ( overdraw !== undefined ){
		this.overdraw = overdraw;
	} else {
		this.overdraw = 1;
	}
	
	//uv_index basically stores how many face corners have been before this one.
	var uv_index = 0;
	var faces = this.faces;
	for( var i=0, len = geometry.faces.length; i < len; ++i ){
		var face = geometry.faces[ i ];
		var l = face.vertices.length;
		
		/*
		* Check how many corners does the current face have
		* If 3, make one face, if 4 make two faces and if more do nothing and whine
		*/
		if ( l !== 3 && l != 4 ){
			console.log( 'unsupported amount of vertices per face', l );
		}
		if ( l === 3 || l === 4 ){
			faces.push( new CANI2D.Face( geometry, texture, face, uv_index, [0,1,2], this.overdraw ) );
		}
		if ( l === 4 ){
			faces.push( new CANI2D.Face( geometry, texture, face, uv_index, [2,3,0], this.overdraw ) );
		}
		uv_index += face.vertices.length;
	}
	
	/*
	* Sort all the faces according to their z to get the right drawing order.
	* Note that this is done only once. If you want to change the drawing order
	* you have to swap the places of the faces again.
	*/
	function compare( a, b ) {
		return a.z - b.z;
	}
	faces.sort( compare );

}

/*
* Utility function to check that the library supports the model.
*/

CANI2D.Mesh.prototype.version_check = function(){
	function match(a, b){
		for( var i = 0; i < 3; ++i ){
			if ( a[ i ] !== b[ i ] ) {
				return false
			}
		}
		return true;
	}
	
	var exporter_version = this.geometry.exporter_version;
	if ( match( CANI2D.version, exporter_version ) ){
		return true;
	}
	for( var i = 0, len = CANI2D.compatible_versions.length; i < len; ++i ){
		if ( match( CANI2D.compatible_versions[ i ], exporter_version ) ){
			return true;
		}
	}
	
	console.log('Cani2D: Exporter version mismatch, please re-export your model');
	return false;
}




CANI2D.Mesh.prototype.init = function(){
}

/*
* Function that calculates sum of vertex group weights for every vertex.
*/

CANI2D.Mesh.prototype.calc_vertex_weights = function(){
	var total_weights = this.total_weights;
	for( var i = 0, len = this.geometry.vertices.length; i < len; ++i ){
		total_weights[ i ] = 0;
	}
	for( var group_name in this.geometry.vertex_groups ){
		var group = this.geometry.vertex_groups[ group_name ];
		for( var i = 0, len = group.length; i < len; ++i ){
			var vertex_weight = group[i];
			total_weights[ vertex_weight[0] ] += vertex_weight[1];
		}
	}
}

/*
* Draw every face in the mesh using vertices as the vertex array.
* When drawing static image vertices is vertex array from geometry.
* When drawing animation vertices is vertex buffer that has the calculated 
* vertex positions.
*/

CANI2D.Mesh.prototype.draw = function(output, vertices){
	if ( vertices === undefined ) {
		vertices = this.geometry.vertices
	}
	var faces = this.faces;
	for( var i = 0, len = faces.length; i < len; ++i ){
		faces[i].draw(output, vertices);
	}
}

/*
* Make animation out of mesh. One mesh can be used to make multiple animations.
*/

CANI2D.Animation = function(mesh){
	this.mesh = mesh;
	this.geometry = mesh.geometry;
	
	//contains only the bones that don't have parents
	this.bones = [];
	//all the bones in loose array (object)
	this.bones_non_recursive = {}
	
	/*
	* Buffer for vertices in animation. Since all vertex positions are 
	* calculated again for every frame you could get rid of this pretty easily.
	* But is it worth it?
	*/
	var vertices = this.vertices = new Array(mesh.geometry.vertices.length);
	for( var i = 0, len = vertices.length; i < len; ++i ){
		vertices[ i ] = this.geometry.vertices[ i ];
	}
	
	//create the bones
	var geometry_bones = mesh.geometry.bones;
	for( var i = 0, len = geometry_bones.length; i < len; ++i ){
		this.bones.push( new CANI2D.Bone( geometry_bones[i], false, this.bones_non_recursive ) );
	}
	
	// Current animation object from geometry.
	this.current = false;
	
	this.frame = 0.0;
	this.fps = 30.0;
	this.loop = true;
	this.playing = false;
}

/*
* Set current animation and start playing.
*/

CANI2D.Animation.prototype.play_animation = function( name ){
	this.set_animation( name );
	this.set_frame( 0 );
	this.play();
}

CANI2D.Animation.prototype.play = function(){
	this.playing = true;
}

CANI2D.Animation.prototype.pause = function(){
	this.playing = false;
}

/*
* Set current animation but don't start playing or change frame.
*/

CANI2D.Animation.prototype.set_animation = function( name ){
	this.current = this.geometry.animations[ name ];
}

/*
* Set current frame to given number.
* Set bone transforms from curves according to new frame.
* Build new poses for all bones.
*/

CANI2D.Animation.prototype.set_frame = function( frame ){
	this.frame = frame;
	
	this.update_curves();
	
	this.build_pose();
}

/*
* Function to set bone transforms according to current frame.
* Read curves for every bone from geometry animation data and act accordingly.
*/

CANI2D.Animation.prototype.update_curves = function(){

	//basic 4 point bezier
	function bezier(t, p0, p1, p2, p3){
		var ct = 1 - t;
		var ct2 = ct * ct;
		var ct3 = ct2 * ct;
		var t2 = t * t;
		var t3 = t2 * t;
		return p0.mul(ct3).add( p1.mul( 3 * ct2 * t ) ).add( p2.mul( 3 * ct * t2 ) ).add( p3.mul( t3 ) ).y;
	}

	var all_curves = this.current.curves;
	var int_to_quat_member = [ 'w', 'x', 'y', 'z' ];
	for( var bone_name in all_curves ){
		var bone = this.bones_non_recursive[ bone_name ];
		var curves = all_curves[ bone_name ];
		for( var i = 0, len = curves.length; i < len; ++i ){
			var curve = curves[ i ];
			var axis = int_to_quat_member[ curve.type[ 1 ] ]
			if ( curve.type[ 0 ] !== 'q' ){
				continue;
			}
			var keys = curve.keys;
			var prev_key = false;
			/*
			* Loop all the keys from beginning to find previous and next 
			* keyframe. Should use binary search instead.
			*/
			for( var keyframe_i = 0, keyframes_l = keys.length; keyframe_i < keyframes_l; ++keyframe_i ){
				var key = keys[ keyframe_i ];
				if ( key[ 0 ] <= this.frame ) {
					prev_key = key;
				} else {
					if( !prev_key ){ // haven't passed even the first key
						//set to the value of the first key
						bone.rotation_q[ axis ] = key[ 1 ] ;
					} else { // middle key, normal case
						//console.log(prev_key, key);
						var time = (this.frame - prev_key[0]) / (key[0] - prev_key[0]);
						var p0 = new CANI2D.Vector(prev_key[0], prev_key[1]);
						var p1 = new CANI2D.Vector(prev_key[3][0], prev_key[3][1]);
						var p2 = new CANI2D.Vector(key[2][0], key[2][1]);
						var p3 = new CANI2D.Vector(key[0], key[1]);
						bone.rotation_q[ axis ] = bezier( time, p0, p1, p2, p3 );
						prev_key = false;
					}
					break;
				}
				if (prev_key) { //all keys are passed, set to value of the last key
					bone.rotation_q[ axis ] = prev_key[ 1 ];
				}
			}
		}
	}
}

/*
* Add dt to current frame.
* When going over animation length depending on loop property either start over 
* or stop and return false.
*/

CANI2D.Animation.prototype.update_animation = function( dt ){
	if ( this.playing ){

		var l = this.current.length;
		this.frame += this.fps / 1000.0 * dt;

		if ( this.frame > l ) {
			if ( this.loop ) {
				this.frame = this.frame % l;
			} else {
				this.pause();
				this.set_frame(this.frame);
				return false;
			}
		}
		this.set_frame(this.frame);
		return true;
	}
}

/*
* Draws animation object.
* If no currect animation draw static mesh.
* Calculate vertex positions and draw.
*/

CANI2D.Animation.prototype.draw = function( output ){
	if (!this.current){
		this.mesh.draw( output );
		return;
	} 
	
	this.skinning();
	
	this.mesh.draw(output, this.vertices);
	
}

/*
* Calculate vertex positions from bone matrices and store results in 
* vertex buffer.
*/

CANI2D.Animation.prototype.skinning = function(){
	var vertices = this.vertices;
	
	/* 
	* Reset vertex location unless weight is zero. Weight zero means that 
	* no bone affects this vertex. If these vertices are zeroed they aren't 
	* drawn at all (subject to change).
	*/
	for( var i = 0, len = vertices.length; i < len; ++i ){
		if ( this.mesh.total_weights[ Math.floor( i / 2 ) ] !== 0 ){
			vertices[ i ] = 0;
		}
	}
	//ref_vertices is rest pose vertice locations
	var ref_vertices = this.geometry.vertices;
	//loop all vertex groups
	for( var group_name in this.geometry.vertex_groups ){
		var group = this.geometry.vertex_groups[ group_name ];
		var bone = this.bones_non_recursive[ group_name ];
		/*
		* bone vertex_matrix, this is kinda crude way to do things
		* maybe need to start using Vector (-_-;)
		*/
		var t = bone.vertex_matrix.elements;

		for( var i = 0, len = group.length; i < len; ++i ){
			var vertex = group[ i ][ 0 ];
			var x = ref_vertices[ vertex * 2 ], y = ref_vertices[ vertex * 2 + 1 ];
			//translate vertex to bone space
			var local_x = x - bone.head_x, local_y = y - bone.head_y
			
			//just basic matrix * vector + back global space, weighted by vertex weight
			vertices[ vertex * 2 ] += ( local_x * t[0] + local_y * t[1] + t[2] + bone.head_x) * group[i][1];
			vertices[ vertex * 2 + 1 ] += ( local_x * t[3] + local_y * t[4] + t[5] + bone.head_y ) * group[i][1];
		}
	}
}

/*
* Build bone matrices. Call build_pose for all parent bones.
*/

CANI2D.Animation.prototype.build_pose = function(){
	var bones = this.bones;
	for( var i = 0, len = bones.length; i < len; ++i){
		bones[i].build_pose();
	}
}

/*
* Bone class. Pretty much only head location, rotation quaternion, matrices
* and child bones.
*/

CANI2D.Bone = function(bone, parent, bones_non_recursive){
	this.name = bone.name;
	var rot = bone.rotation;
	this.rotation_q = new CANI2D.Quat(-1,0,0,0);
	this.parent = parent;
	
	//calculate head location in both global and parent space
	if ( parent ) {
		this.head_local_x = bone.head[ 0 ];
		this.head_local_y = bone.head[ 1 ];
		this.head_x = bone.head[ 0 ] + this.parent.head_x;
		this.head_y = bone.head[ 1 ] + this.parent.head_y;
	} else {
		this.head_local_x = 0;
		this.head_local_y = 0;
		this.head_x = bone.head[ 0 ];
		this.head_y = bone.head[ 1 ];
	}
	
	//pose in bone space
	this.pose = this.pose_matrix();
	if ( parent ) {
		// now global space
		this.pose = parent.pose.multiply( this.pose );
	}
	//calculate inverse for future usage, used to transform from global to local
	this.inverse = this.pose.inverse();
	this.vertex_matrix = CANI2D.Matrix.identity();
	
	//store this bone also in the alternative storage for bones, hackish
	bones_non_recursive[ this.name ] = this;
	
	this.children = [];
	for( var i = 0, len = bone.children.length; i < len; ++i ){
		this.children.push( new CANI2D.Bone( bone.children[ i ], this, bones_non_recursive ) );
	}	
}

/*
* Calculate basic pose matrix. Rotation and translation in local space.
*/
CANI2D.Bone.prototype.pose_matrix = function(){
	return this.rotation_q.to_matrix().translate( this.head_local_x, this.head_local_y );
}

/*
* Function to calculate all bone matrices for the rig.
*/

CANI2D.Bone.prototype.build_pose = function(){
	//now local
	this.pose = this.pose_matrix();
	if ( this.parent ){
		//now global
		this.pose = this.parent.pose.multiply( this.pose );
	}
	//after this local again but affected by parent's transform
	this.vertex_matrix = this.inverse.multiply( this.pose );
	
	//build pose also for the child bones 
	var children = this.children;
	for( var i = 0, len = children.length; i < len; ++i ){
		children[i].build_pose();
	}
}

/*
* Rest is just some boring math stuff.
*
* Here lies:
* Vector (underused and not liked)
* Matrix 3x3
* Quat - Quaternion, to_matrix returns definitely not standard 2x2 rotation
*/

CANI2D.Vector = function( x , y ){
	this.x = x;
	this.y = y;
}

CANI2D.Vector.from_index = function( i, table ){
	return new CANI2D.Vector( table[ i ], table[ i + 1 ] );
}

CANI2D.Vector.prototype.mul = function( k ){
	return new CANI2D.Vector( this.x * k, this.y * k );
}

CANI2D.Vector.prototype.add = function( v ){
	return new CANI2D.Vector( this.x + v.x, this.y + v.y );
}

CANI2D.Matrix = function( m11, m12, m13, m21, m22, m23, m31, m32, m33 ){
	this.elements = new Float32Array(9);
	var t = this.elements;
	t[0] = m11, t[1] = m12, t[2] = m13,
	t[3] = m21, t[4] = m22, t[5] = m23,
	t[6] = m31, t[7] = m32, t[8] = m33;
}

CANI2D.Matrix.prototype.inspect = function(){
	var t = this.elements;
	return '[' + t[0] + ',' + t[1] + ',' + t[2] + ']\n' +
			'[' + t[3] + ',' + t[4] + ',' + t[5] + ']\n' +
			'[' + t[6] + ',' + t[7] + ',' + t[8] + ']'
}

CANI2D.Matrix.identity = function(){
	return new CANI2D.Matrix(1,0,0,
							 0,1,0,
							 0,0,1);
}

CANI2D.Matrix.prototype.inverse = function(){
	var t = this.elements;
	var m11 = t[0], m12 = t[1], m13 = t[2],
		m21 = t[3], m22 = t[4], m23 = t[5],
		m31 = t[6], m32 = t[7], m33 = t[8];
	var det = m11*m22*m33 + m12*m23*m31 + m13*m21*m32 - m11*m23*m32 - m12*m21*m33 - m13*m22*m31;
	return new CANI2D.Matrix((m22*m33 - m23*m32)/det, (m13*m32 - m12*m33)/det, (m12*m23 - m13*m22)/det,
							 (m23*m31 - m21*m33)/det, (m11*m33 - m13*m31)/det, (m13*m21 - m11*m23)/det,
							 (m21*m32 - m22*m31)/det, (m12*m31 - m11*m32)/det, (m11*m22 - m12*m21)/det);
}

CANI2D.Matrix.prototype.multiply = function(b){
	var te = this.elements;
	var be = b.elements;
	var m11 = te[0], m12 = te[1], m13 = te[2],
	m21 = te[3], m22 = te[4], m23 = te[5],
	m31 = te[6], m32 = te[7], m33 = te[8];
	var b11 = be[0], b12 = be[1], b13 = be[2],
	b21 = be[3], b22 = be[4], b23 = be[5],
	b31 = be[6], b32 = be[7], b33 = be[8];
	return new CANI2D.Matrix(m11*b11 + m12*b21 + m13*b31, m11*b12 + m12*b22 + m13*b32,m11*b13 + m12*b23 + m13*b33,
							 m21*b11 + m22*b21 + m23*b31, m21*b12 + m22*b22 + m23*b32,m21*b13 + m22*b23 + m23*b33,
							 m31*b11 + m32*b21 + m33*b31, m31*b12 + m32*b22 + m33*b32,m31*b13 + m32*b23 + m33*b33)
}

CANI2D.Matrix.prototype.translate = function(x,y){
	var t = this.elements;
	t[2] += x * t[0] + y * t[1];
	t[5] += x * t[3] + y * t[4];
	t[8] += x * t[6] + y * t[7];
	return this;
}

CANI2D.Quat = function(w, x, y, z){
	this.w = w;
	this.x = x;
	this.y = y;
	this.z = z;
}

CANI2D.Quat.prototype.inspect = function(){
	return '[' + this.w + ', ' +this.x +', ' +this.y+', ' +this.z+']'
}

CANI2D.Quat.prototype.normalize_self = function(){
	var w = this.w, x = this.x, y = this.y, z = this.z;
	var l = Math.sqrt( w * w + x * x + y * y + z * z );

	l = 1 / l;
	this.w = w * l;
	this.x = x * l;
	this.y = y * l;
	this.z = z * l;
	return this;
}

CANI2D.Quat.prototype.to_matrix = function(){
	this.normalize_self();
	var w = this.w, x = this.x, y = this.y, z = this.z;
	var x2 = x + x, y2 = y + y, z2 = z + z;
	var xx = x * x2, xy = x * y2, xz = x * z2;
	var yy = y * y2, yz = y * z2, zz = z * z2;
	var wx = w * x2, wy = w * y2, wz = w * z2;

	return new CANI2D.Matrix(1 - ( yy + zz ), 	xy - wz, 		0,
							xy + wz, 			1 - ( xx + zz ),0,
							0,					0,				1)
}

CANI2D.Quat.prototype.rotate_vector = function(v){
	this.normalize_self();
	var w = this.w, x = this.x, y = this.y, z = this.z;
	var x2 = x + x, y2 = y + y, z2 = z + z;
	var xx = x * x2, xy = x * y2, xz = x * z2;
	var yy = y * y2, yz = y * z2, zz = z * z2;
	var wx = w * x2, wy = w * y2, wz = w * z2;
	return CANI2D.Vector(	v.x * (1 - ( yy + zz )) + v.y * xy - wz,
							v.x * (xy + wz) + v.y * 1 - ( xx + zz ) )
}
