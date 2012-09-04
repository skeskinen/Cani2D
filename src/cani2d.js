requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
//Current library version and all previous versions that had same model format
Cani2D = {version: [0,0,2], compatible_versions:[]};

/*
* Function to clear given canvas.
* http://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
*/

Cani2D.clear = function( ctx ){
		// Store the current transformation matrix
		ctx.save();

		// Use the identity matrix while clearing the canvas
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Restore the transform
		ctx.restore();
}

/*
*	Face class stores buffers of one polygon. 
*/

Cani2D.Face = function( texture, face, uv, overdraw ){
	
	// Vertice indices, int array.
	this.indices = face;
	
	//texture coordinates
	this.uv = uv;
	
	//draw order z
	this.z = 0.0;
	
	this.buffers = [];

	for( var i = 1, len = face.length - 1; i < len; ++i ){
		var triangle_indices = [];
		var triangle_uv = [];
		
		for( var p = 0; p < 3; ++p){
			triangle_indices.push( this.indices[ (i + p) % (i + 2) ] );
			triangle_uv.push( this.uv[ (i + p) % (i + 2) ] );
		}

		this.buffers.push( new Cani2D.Buffer( texture, triangle_indices, triangle_uv, overdraw ) );
	}
}	

Cani2D.Face.prototype.draw = function( output, vertices ) {
	var buffers = this.buffers;
	for( var i = 0, len = buffers.length; i < len; ++i ){
		buffers[ i ].draw( output, vertices );
	}
}

Cani2D.Buffer = function( texture, indices, uv, overdraw ){
	this.canvas = document.createElement('canvas');
	this.ctx = this.canvas.getContext('2d');

	this.indices = indices;
	this.uv = uv;

	/*
	*	Calculate face texture bounds. These are used to make fitting
	*	buffer for the face.
	*	min_x and min_y also tell us where the texture starts and
	*	are used as offset.
	*/
	
	var min_x = 1.0, max_x = 0.0, min_y = 1.0, max_y = 0.0;
	for(var i = 0; i < 3; i++){
		min_x = Math.min( min_x, uv[ i ][0] );
		max_x = Math.max( max_x, uv[ i ][0] );
		min_y = Math.min( min_y, uv[ i ][1] );
		max_y = Math.max( max_y, uv[ i ][1] );
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
	var pixel_w = Math.ceil( this.w * t_w );
	var pixel_h = Math.ceil( this.h * t_h );
	
	// ceiling changes buffer size so need to recalculate this
	this.w = pixel_w / t_w, this.h = pixel_h / t_h;
	
	//store offsets for drawing
	this.offset = new Cani2D.Vector2(min_x, min_y);

	var canvas = this.canvas;
	
	canvas.width = pixel_w;
	canvas.height = pixel_h;
	
	// draw the texture to buffer
	this.draw_to_buffer( texture, overdraw );
	
}

/*
*	Function that draws the correct part of the whole texture into the buffer.
*/

Cani2D.Buffer.prototype.draw_to_buffer = function( texture, overdraw ){
	//clone texture coordinates for expanding
	
	var uv0 = this.uv[0].clone();
	var uv1 = this.uv[1].clone();
	var uv2 = this.uv[2].clone();
	
	var w = texture.width, h = texture.height;
	
	/*
	*	Function to push each point aprox. n pixel farther from eachother.
	*	Used to expand the buffered texture.
	*	This hides the gaps between faces, since every face is actually drawn
	*	n pixel larger than it "should" be.
	*	three.js canvas renderer used as reference.
	*/
	
	function expand( a, b ) {
		var x = b[0] - a[0], y = b[1] - a[1],
		det = x * x + y * y, idet;

		if ( det === 0 ) return;

		idet = 1 / Math.sqrt( det );

		x *= idet / w * overdraw; y *= idet / h * overdraw;

		b[0] += x; b[1] += y;
		a[0] -= x; a[1] -= y;
	}
	
	//Expand texture. The stored texture coordinates are not affected.		
	expand( uv0, uv1);
	expand( uv1, uv2);
	expand( uv2, uv0);
	
	var ctx = this.ctx;
	ctx.save();
	/*
	*	Scale w,h and translate -w*offset_x, -h*offset_y.
	*	With this texture is not scaled and drawn inside buffer bounds.
	*/
	ctx.setTransform( w, 0, 0, h, -w*this.offset[0], -h*this.offset[1] );
	
	/*
	*	Create the path and clip to it. This operation is slow.
	*	This is the main reason why textures are buffered per face.
	*/
	ctx.beginPath(); ctx.moveTo( uv0[0], uv0[1] ); ctx.lineTo( uv1[0], uv1[1] );
	ctx.lineTo( uv2[0], uv2[1] ); ctx.closePath(); ctx.clip();

	ctx.drawImage( texture, 0, 0, 1, 1 );
	ctx.restore();
}

/*
* The function that actually does all the drawing. 
* vertices is array of vertex coordinates from which coordinates are picked 
* acording to stored vertex indices.
*/

Cani2D.Buffer.prototype.draw = function(output, vertices){
	var uv = this.uv;
	var indices = this.indices;
	var x0 = vertices[ indices[0] ].x, x1 = vertices[ indices[1] ].x, x2 = vertices[ indices[2] ].x;
	var y0 = vertices[ indices[0] ].y, y1 = vertices[ indices[1] ].y, y2 = vertices[ indices[2] ].y;
	
	var s0 = uv[ 0 ].x, s1 = uv[ 1 ].x, s2 = uv[ 2 ].x;
	var t0 = uv[ 0 ].y, t1 = uv[ 1 ].y, t2 = uv[ 2 ].y;
	
	/*
	*	Calculate texture mapping transform matrix.
	*	Reference: http://stackoverflow.com/questions/4774172/image-manipulation-and-texture-mapping-using-html5-canvas
	*/
	
	var det = s0*t1 + t0*s2 + s1*t2 - t1*s2 - t0*s1 - s0*t2;
	var a = (x0*t1 + t0*x2 + x1*t2 - t1*x2 - t0*x1 - x0*t2)/det;
	var b = (s0*x1 + x0*s2 + s1*x2 - x1*s2 - x0*s1 - s0*x2)/det;
	var c = (s0*t1*x2 + t0*x1*s2 + x0*s1*t2 - x0*t1*s2
				  - t0*s1*x2 - s0*x1*t2)/det;
	var d = (y0*t1 + t0*y2 + y1*t2 - t1*y2 - t0*y1 - y0*t2)/det;
	var e = (s0*y1 + y0*s2 + s1*y2 - y1*s2 - y0*s1 - s0*y2)/det;
	var f = (s0*t1*y2 + t0*y1*s2 + y0*s1*t2 - y0*t1*s2
				  - t0*s1*y2 - s0*y1*t2)/det;
	
	output.save();
	//set the transform that we just calculated
	output.transform( a, d, b, e, c, f );
	/* 
	* draw the triangle from the buffer, w and h are buffer size relative to
	* the size of the whole texture [0,1]
	*/
	output.drawImage( this.canvas, this.offset[0], this.offset[1], this.w, this.h );

	//revert transform
	output.restore();
}

/*
*	Class mesh combines geometry and texture into drawable object.
*/

Cani2D.Mesh = function(geometry, texture, overdraw){
	
	var geometry = JSON.parse(geometry);
	//compare geometry and library version
	this.version_check(geometry.exporter_version);


	//import vertices
	this.vertices = [];

	for ( var i = 0, len = geometry.vertices.length; i < len; i = i + 3 ){
		this.vertices.push( Cani2D.Vector.from_index( i, geometry.vertices ) );
	}

	//import uv coordinates
	this.uv = [];

	for ( var i = 0, len = geometry.uv.length; i < len; i = i + 2 ){
		this.uv.push( Cani2D.Vector2.from_index( i, geometry.uv ) );
	}

	//import vertex groups
	this.vertex_group_indices = geometry.vertex_group_indices;
	this.vertex_group_weights = geometry.vertex_group_weights;
	this.vertex_group_weighted = [];
	this.vertex_group_names = geometry.vertex_group_names;

	this.normalize_weights();

	/*
	var vg = this.vertex_group_weights;
	for(var i =0; i<vg.length; ++i){
		console.log('new', i);
		for(var p =0; p<vg[i].length; ++p){
			console.log(vg[i][p]);
		}
	}
	*/

	//import bones
	this.bones = [];

	var geometry_bones = geometry.bones;
	for( var i = 0, len = geometry_bones.length; i < len; ++i ){
		this.bones.push( new Cani2D.Bone( geometry_bones[ i ], this.bones ) );
	}
	this.bone_names = geometry.bone_names;

	//import animations
	this.animations = geometry.animations;	

	//generate faces
	this.faces = [];

	//texture overdraw, default value 1
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
		var l = face.length;
		
		var face_uv = [];
		for( var p = 0, len2 = face.length; p < len2; ++p ){
			face_uv.push( this.uv[ uv_index++ ] );
		}
		faces.push( new Cani2D.Face( texture, face, face_uv, this.overdraw ) );
	}
	
	/*
	* Sort all the faces according to their z to get the right drawing order.
	*/
	function compare( a, b ) {
		return a.z - b.z;
	}
	faces.sort( compare );

}

/*
* Utility function to check that the library supports the model.
*/

Cani2D.Mesh.prototype.version_check = function( exporter_version ){
	function match(a, b){
		for( var i = 0; i < 3; ++i ){
			if ( a[ i ] !== b[ i ] ) {
				return false
			}
		}
		return true;
	}
	
	if ( match( Cani2D.version, exporter_version ) ){
		return true;
	}
	for( var i = 0, len = Cani2D.compatible_versions.length; i < len; ++i ){
		if ( match( Cani2D.compatible_versions[ i ], exporter_version ) ){
			return true;
		}
	}
	
	console.log('Cani2D: Exporter version mismatch, please re-export your model');
	return false;
}

/*
* Function that calculates sum of vertex group weights for every vertex and normalizes them.
*/

Cani2D.Mesh.prototype.normalize_weights = function(){
	var vertex_group_weights = this.vertex_group_weights;
	for( var i = 0, len = this.vertices.length; i < len; ++i ){
		var weights = vertex_group_weights[ i ];
		var weight = 0;
		for( var p = 0, len2 = weights.length; p < len2; ++p ){
			weight += weights[ p ];
		}
		if ( weight > 0.001 ) {
			if ( Math.abs( weight - 1 ) > 0.001 ) {
				var k = 1 / weight;
				
				for( var p = 0, len2 = weights.length; p < len2; ++p ){
					weights[ p ] *= k;
				}
			}
			
			this.vertex_group_weighted.push( true );
		} else {
			this.vertex_group_weighted.push( false );
		}

	}
}

/*
* Draw every face in the mesh using vertices as the vertex array.
* When drawing static image vertices is vertex array from geometry.
* When drawing animation vertices is vertex buffer that has the calculated 
* vertex positions.
*/

Cani2D.Mesh.prototype.draw = function(output, vertices){
	if ( vertices === undefined ) {
		vertices = this.vertices
	}
	var faces = this.faces;
	for( var i = 0, len = faces.length; i < len; ++i ){
		faces[ i ].draw(output, vertices);
	}
}

/*
* Make animation out of mesh. One mesh can be used to make multiple animations.
*/

Cani2D.Animation = function(mesh){
	this.mesh = mesh;
	this.geometry = mesh.geometry;
	
	this.pose = [];
	
	/*
	* Buffer for vertices in animation. Since all vertex positions are 
	* calculated again for every frame you could get rid of this pretty easily.
	*/
	var vertices = this.vertices = [];
	var mesh_vertices = mesh.vertices;
	for( var i = 0, len = mesh_vertices.length; i < len; ++i ){
		vertices.push( mesh_vertices[ i ].clone() );
	}
	
	//create the poses for the bones
	var bones = mesh.bones;
	for( var i = 0, len = bones.length; i < len; ++i ){
		this.pose.push( new Cani2D.Pose( bones[i], this.pose ) );
	}
	
	// Current animation object from geometry.
	this.current = false;
	
	this.frame = 0.0;
	this.fps = 24.0;
	this.loop = true;
	this.playing = false;
}

/*
* Set current animation and start playing.
*/

Cani2D.Animation.prototype.play_animation = function( name ){
	this.set_animation( name );
	this.set_frame( 0 );
	this.play();
}

Cani2D.Animation.prototype.play = function(){
	this.playing = true;
}

Cani2D.Animation.prototype.pause = function(){
	this.playing = false;
}

/*
* Set current animation but don't start playing or change frame.
*/

Cani2D.Animation.prototype.set_animation = function( name ){
	this.current = this.mesh.animations[ name ];
}

/*
* Set current frame to given number.
* Set bone transforms from curves according to new frame.
* Build new poses for all bones.
*/

Cani2D.Animation.prototype.set_frame = function( frame ){
	this.frame = frame;
	
	this.update_curves();
	
	this.build_pose();
}

/*
* Function to set bone transforms according to current frame.
* Read curves for every bone from geometry animation data and act accordingly.
*/

Cani2D.Animation.prototype.update_curves = function(){

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
	for( var bone_name in all_curves ){
		var pose = this.pose[ bone_name ];
		var curves = all_curves[ bone_name ];
		for( var i = 0, len = curves.length; i < len; ++i ){
			var curve = curves[ i ];
			var type = curve.type;
			if ( type[ 0 ] !== 'q' ){
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
						pose.rotation_q[ type[1] ] = key[ 1 ] ;
					} else { // middle key, normal case
						//console.log(prev_key, key);
						var time = (this.frame - prev_key[0]) / (key[0] - prev_key[0]);
						var p0 = new Cani2D.Vector2(prev_key[0], prev_key[1]);
						var p1 = new Cani2D.Vector2(prev_key[3][0], prev_key[3][1]);
						var p2 = new Cani2D.Vector2(key[2][0], key[2][1]);
						var p3 = new Cani2D.Vector2(key[0], key[1]);
						pose.rotation_q[ type[1] ] = bezier( time, p0, p1, p2, p3 );
						prev_key = false;
					}
					break;
				}
				if (prev_key) { //all keys are passed, set to value of the last key
					pose.rotation_q[ type[1] ] = prev_key[ 1 ];
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

Cani2D.Animation.prototype.update_animation = function( dt ){
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

Cani2D.Animation.prototype.draw = function( output ){
	if (!this.current){
		this.mesh.draw( output );
		return;
	} 
	
	this.skinning();
	
	this.mesh.draw(output, this.vertices);
	
}

/*
* Calculate vertex positions from pose matrices and store results in 
* vertex buffer.
*/

Cani2D.Animation.prototype.skinning = function(){
	var vertices = this.vertices;
	var rest_vertices = this.mesh.vertices;
	var mesh = this.mesh;

//console.log(mesh.vertex_group_weighted);	

	for( var vertex_i = 0, len = vertices.length; vertex_i < len; ++vertex_i ){
		//only skin weighted vertices, vertices that are affected by bones
		if ( mesh.vertex_group_weighted[ vertex_i ] ){
		//	console.log(vertex_i);
			// Reset vertex location
			var vertex = new Cani2D.Vector(0,0,0);
			var rest_vertex = rest_vertices[ vertex_i ];
 			var weights = mesh.vertex_group_weights[ vertex_i ];
			var indices = mesh.vertex_group_indices[ vertex_i ];
			for( var i = 0, len2 = weights.length; i < len2; ++i ){
				var weight = weights[ i ];
				var bone_i = indices[ i ];
				var pose = this.pose[ bone_i ];
				var bone_head = pose.bone.head;
				var m = pose.vertex_matrix;
//				m = Cani2D.Matrix.identity();
				
				var offset = rest_vertex.sub( bone_head );
				//console.log(bone_head, rest_vertex, offset);
				offset = m.mul_v(offset);
				vertex = vertex.add( (bone_head.add(offset)).mul( weight ) );

			}
//			console.log(vertex, rest_vertices[vertex_i], vertex_i);
			vertices[ vertex_i ] = vertex;
		}
	}
//	console.log(vertices[0], rest_vertices[0]);
}

/*
* Build bone matrices. Call build_pose for all parent bones.
*/

Cani2D.Animation.prototype.build_pose = function(){
	var pose = this.pose;
	for( var i = 0, len = pose.length; i < len; ++i){
		pose[i].build_pose();
	}
}

/*
 * Bone class. Bone location and parents. Bone transforms done in pose.
 */

Cani2D.Bone = function( bone, bones ){
	this.head = Cani2D.Vector.from_index(0, bone);
	this.parent_index = bone[3];
	if( this.parent_index === -1 ) {
		this.parent = false;
	} else {
		this.parent = bones[ this.parent_index ];
	}

	if( this.parent ) {
		this.head_local = this.head.sub( this.parent.head );
	} else {
		this.head_local = this.head.clone();
	}
	
}

/*
* Pose class. Stores bone transforms.
*/

Cani2D.Pose = function( bone, poses ){
	this.bone = bone;

	this.rotation_q = new Cani2D.Quat(-1,0,0,0);
	this.translation = new Cani2D.Vector(0,0,0);
	this.scale = new Cani2D.Vector(1,1,1);
	if ( bone.parent ){
		this.parent = poses[ bone.parent_index ];
	} else {
		this.parent = false;
	}

	//pose in bone space
	this.pose = this.pose_matrix();
	if ( this.parent ) {
		// now global space
		this.pose = this.parent.pose.multiply( this.pose );
	}
	//calculate inverse for future usage, used to transform from global to local
	this.inverse = this.pose.inverse_transform();
	this.vertex_matrix = Cani2D.Matrix.identity();
	
	console.log(this.bone.head, this.bone.head_local, this.bone.parent);

	
}

/*
* Calculate basic pose matrix. Rotation and translation in local space.
*/
Cani2D.Pose.prototype.pose_matrix = function(){
//	console.log(this.rotation_q, this.rotation_q.to_matrix().inspect());
	return this.rotation_q.to_matrix().translate( this.bone.head_local.add( this.translation ) );
}

/*
* Function to calculate all bone matrices for the rig.
*/

Cani2D.Pose.prototype.build_pose = function(){
	//now local
	this.pose = this.pose_matrix();
	if ( this.parent ){
		//now global
		this.pose = this.parent.pose.multiply( this.pose );
	}
	//after this local again but affected by parent's transform
	this.vertex_matrix = this.inverse.multiply( this.pose );
	
	console.log('bone');
//	console.log(this.name);
	console.log(this.pose.inspect());
	console.log(this.inverse.inspect());
	console.log(this.vertex_matrix.inspect());
}

/*
* Rest is just some boring math stuff.
*
* Here lies:
* Vector2
* Vector 
* Matrix 4x4
* Quat - Quaternion
* 
* Using prototype array and defineProperty array access is as fast as usual
* but property access is about x20 slower (node v0.8.8, v8 3.11.10.19).
* Still doing define property has no downsides other than src filesize so 
* might aswell do it. Just do all the heavy stuff with [].
*/

Cani2D.Vector2 = function( x , y ){
	this.length = 2;
	this[0] = x;
	this[1] = y;
}

Cani2D.Vector2.prototype = new Array();

Object.defineProperty(Cani2D.Vector2.prototype, 'x', {
	get: function() { return this[ 0 ]; },
	set: function( x ) { this[ 0 ] = x; }
});

Object.defineProperty(Cani2D.Vector2.prototype, 'y', {
	get: function() { return this[ 1 ]; },
	set: function( y ) { this[ 1 ] = y; }
});

Cani2D.Vector2.prototype.mul = function( k ){
	return new Cani2D.Vector2( this[0] * k, this[1] * k );
}

Cani2D.Vector2.prototype.add = function( v ){
	return new Cani2D.Vector2( this[0] + v[0], this[1] + v[1] );
}

Cani2D.Vector2.prototype.clone = function(){
	return new Cani2D.Vector2( this[0], this[1] );
}

Cani2D.Vector2.from_index = function( i, table ){
	return new Cani2D.Vector2( table[ i ], table[ i + 1 ] );
}

Cani2D.Vector = function( x , y, z ){
	this.length = 3;
	this[0] = x;
	this[1] = y;
	this[2] = z;
}

Cani2D.Vector.prototype = new Array();

Object.defineProperty(Cani2D.Vector.prototype, 'x', {
	get: function() { return this[ 0 ]; },
	set: function( x ) { this[ 0 ] = x; }
});

Object.defineProperty(Cani2D.Vector.prototype, 'y', {
	get: function() { return this[ 1 ]; },
	set: function( y ) { this[ 1 ] = y; }
});

Object.defineProperty(Cani2D.Vector.prototype, 'z', {
	get: function() { return this[ 2 ]; },
	set: function( z ) { this[ 2 ] = z; }
});

Cani2D.Vector.from_index = function( i, table ){
	return new Cani2D.Vector( table[ i ], table[ i + 1 ], table[ i + 2 ] );
}

Cani2D.Vector.prototype.mul = function( k ){
	return new Cani2D.Vector( this[0] * k, this[1] * k, this[2] * k );
}

Cani2D.Vector.prototype.add = function( v ){
	return new Cani2D.Vector( this[0] + v[0], this[1] + v[1], this[2] + v[2] );
}

Cani2D.Vector.prototype.sub = function( v ){
	return new Cani2D.Vector( this[0] - v[0], this[1] - v[1], this[2] - v[2] );
}

Cani2D.Vector.prototype.clone = function(){
	return new Cani2D.Vector( this[0], this[1], this[2] );
}

Cani2D.Matrix = function( m11, m12, m13, m14, m21, m22, m23, m24, m31, m32, m33, m34, m41, m42, m43, m44 ){
	this.length = 16;
	this[0] = m11, this[1] = m12, this[2] = m13, this[3] = m14,
	this[4] = m21, this[5] = m22, this[6] = m23, this[7] = m24,
	this[8] = m31, this[9] = m32, this[10] = m33, this[11] = m34,
	this[12] = m41, this[13] = m42, this[14] = m43, this[15] = m44;
}

Cani2D.Matrix.prototype = new Array();

Cani2D.Matrix.prototype.inspect = function(){
	return '[' + this[0] + ',' + this[1] + ',' + this[2] + ','+this[3]+ ']\n' +
			'[' + this[4] + ',' + this[5] + ',' + this[6] + ','+this[7]+']\n' +
			'[' + this[8] + ',' + this[9] + ',' + this[10] + ','+this[11]+']\n'+
			'[' + this[12] + ',' + this[13] + ',' + this[14] + ','+this[15]+']'
}

Cani2D.Matrix.identity = function(){
	return new Cani2D.Matrix(1,0,0,0,
							 0,1,0,0,
							 0,0,1,0,
							 0,0,0,1);
}

/*
 * Info:
 * http://en.wikipedia.org/wiki/Affine_transformation
 * http://www.fastgraph.com/makegames/3drotation/
 */

Cani2D.Matrix.prototype.inverse_transform = function(){

	var m11 = this[0], m12 = this[1], m13 = this[2], m14 = this[3],
		m21 = this[4], m22 = this[5], m23 = this[6], m24 = this[7],
		m31 = this[8], m32 = this[9], m33 = this[10], m34 = this[11];
/*
	var det = m11*m22*m33 + m12*m23*m31 + m13*m21*m32 - m11*m23*m32 - m12*m21*m33 - m13*m22*m31;
	return new Cani2D.Matrix((m22*m33 - m23*m32)/det, (m13*m32 - m12*m33)/det, (m12*m23 - m13*m22)/det,
							 (m23*m31 - m21*m33)/det, (m11*m33 - m13*m31)/det, (m13*m21 - m11*m23)/det,
							 (m21*m32 - m22*m31)/det, (m12*m31 - m11*m32)/det, (m11*m22 - m12*m21)/det);
*/
	return new Cani2D.Matrix(	m11, 	m21, 	m31,	-m14 * m11 - m24 * m21 - m34 * m31,
								m12, 	m22,	m32,	-m14 * m12 - m24 * m22 - m34 * m32,
								m13,	m23,	m33,	-m14 * m13 - m24 * m23 - m34 * m33,
								0,		0,		0,		1);
}

/*
 * From three.js matrix
 * https://github.com/mrdoob/three.js/blob/master/src/core/Matrix4.js
 */

Cani2D.Matrix.prototype.multiply = function(b){

	var a11 = this[0], a12 = this[1], a13 = this[2], a14 = this[3],
	 	a21 = this[4], a22 = this[5], a23 = this[6], a24 = this[7],
	 	a31 = this[8], a32 = this[9], a33 = this[10], a34 = this[11],
	 	a41 = this[12], a42 = this[13], a43 = this[14], a44 = this[15];

	var b11 = b[0], b12 = b[1], b13 = b[2], b14 = b[3],
	 	b21 = b[4], b22 = b[5], b23 = b[6], b24 = b[7],
	 	b31 = b[8], b32 = b[9], b33 = b[10], b34 = b[11],
	 	b41 = b[12], b42 = b[13], b43 = b[14], b44 = b[15];

	return new Cani2D.Matrix(
		a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41,
		a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42,
		a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43,
		a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44,

		a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41,
		a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42,
		a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43,
		a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44,

		a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41,
		a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42,
		a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43,
		a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44,

		a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41,
		a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42,
		a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43,
		a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44
	)
}

Cani2D.Matrix.prototype.mul_v = function( v ) {
	return new Cani2D.Vector(	this[0] * v[0] + this[1] * v[1] + this[2] * v[2] + this[3],
								this[4] * v[0] + this[5] * v[1] + this[6] * v[2] + this[7],
								this[8] * v[0] + this[9] * v[1] + this[10] * v[2] + this[11])
}

Cani2D.Matrix.prototype.translate = function( v ){
	/*
	this[3] += v[0] * this[0] + v[1] * this[1] + v[2] * this[2];
	this[7] += v[0] * this[4] + v[1] * this[5] + v[2] * this[6];
	this[11] += v[0] * this[8] + v[1] * this[9] + v[2] * this[10];
	*/
	this[3] += v[0];
	this[7] += v[1];
	this[11] += v[2];
	return this;
}

Cani2D.Quat = function(w, x, y, z){
	this.length = 4;
	this[0] = w;
	this[1] = x;
	this[2] = y;
	this[3] = z;
}

Cani2D.Quat.prototype = new Array();

Object.defineProperty(Cani2D.Quat.prototype, 'w', {
	get: function() { return this[ 0 ]; },
	set: function( w ) { this[ 0 ] = w; }
});

Object.defineProperty(Cani2D.Quat.prototype, 'x', {
	get: function() { return this[ 1 ]; },
	set: function( x ) { this[ 1 ] = x; }
});

Object.defineProperty(Cani2D.Quat.prototype, 'y', {
	get: function() { return this[ 2 ]; },
	set: function( y ) { this[ 2 ] = y; }
});

Object.defineProperty(Cani2D.Quat.prototype, 'z', {
	get: function() { return this[ 3 ]; },
	set: function( z ) { this[ 3 ] = z; }
});


Cani2D.Quat.prototype.inspect = function(){
	return '[' + this[0] + ', ' +this[1] +', ' +this[2]+', ' +this[3]+']'
}

Cani2D.Quat.prototype.normalize_self = function(){
	var w = this[0], x = this[1], y = this[2], z = this[3];
	var l = Math.sqrt( w * w + x * x + y * y + z * z );

	l = 1 / l;
	this[0] = w * l;
	this[1] = x * l;
	this[2] = y * l;
	this[3] = z * l;
	return this;
}

/*
 * From three.js matrix
 * https://github.com/mrdoob/three.js/blob/master/src/core/Matrix4.js
 */

Cani2D.Quat.prototype.to_matrix = function(){
	this.normalize_self();
	var w = this[0], x = this[1], y = this[2], z = this[3];
	var x2 = x + x, y2 = y + y, z2 = z + z;
	var xx = x * x2, xy = x * y2, xz = x * z2;
	var yy = y * y2, yz = y * z2, zz = z * z2;
	var wx = w * x2, wy = w * y2, wz = w * z2;

	return new Cani2D.Matrix(	1 - ( yy + zz ), 	xy - wz, 			xz - wy, 			0,
								xy + wz, 			1 - ( xx + zz ),	yz + wx,			0,
								xz + wy,			yz - wx,			1 - ( xx + yy ),	0,
								0,					0,					0,					1)
}

