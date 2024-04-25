/**
 * WordPress dependencies.
 */
import apiFetch from '@wordpress/api-fetch';
import { createBlock, getBlockContent, rawHandler } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';

const NEWSPACK_CONVERTER_API_BASE_URL = '/newspack-content-converter';

/**
 * Runs conversion of multiple Posts.
 *
 * @param string postIdsCsv CSV string of Post IDs.
 * @returns {Promise<void>}
 */
export function runMultiplePosts( postIds ) {
	let result = Promise.resolve();
	postIds.forEach( ( postId, key ) => {
		postId = parseInt( postId );
		result = result.then( () => {
			console.log( `converting ${ postId }, ${ key + 1 }/${ postIds.length } ` );
			return runSinglePost( postId );
		} );
	} );

	return result;
}

/**
 * Conversion of a single Post.
 * Uses promise chaining to ensure sequential execution of async operations.
 *
 * @param postId
 * @returns {Promise<void | never>}
 */
export function runSinglePost( postId ) {
	return removeAllBlocks()
		.then( () => getPostContentById( postId ) )
		.then( html => insertClassicBlockWithContent( html ) )
		.then( html => dispatchConvertClassicToBlocks( html ) )
		.then( html => getAllBlocksContents( postId, html ) )
		.then( ( [ blocks, html ] ) => updatePost( postId, blocks, html ) )
		.catch( error => {
			console.error( 'A conversion error occured in runSinglePost:' );
			console.error( error );
		} );
}

/**
 * Clears all blocks from the Block Editor.
 * @returns {Promise<any> | Promise}
 */
export function removeAllBlocks() {
	return new Promise( function( resolve, reject ) {
		dispatch( 'core/block-editor' ).resetBlocks( [] );
		return resolve();
	} );
}

/**
 * Fetches contents of a single Post or Page.
 *
 * @param id
 * @returns string
 */
export function getPostContentById( id ) {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + `/get-post-content/${ id }`,
	} ).then( response => {
		return Promise.resolve( response );
	} );
}

/**
 * Prepares a Classic Block with Post's data loaded as content, and inserts it into the Block Editor.
 *
 * @param String html HTML source before conversion.
 * @returns {Promise<any> | Promise}
 */
export function insertClassicBlockWithContent( html ) {
	return new Promise( function( resolve, reject ) {
		const block = createBlock( 'core/freeform' );
		block.attributes.content = html;
		dispatch( 'core/block-editor' ).insertBlocks( block );
		// --- OR: let block = wp.blocks.createBlock( "core/freeform", { content: 'test' } );
		resolve( html );
	} );
}

/**
 * Triggers conversion of all Classic Blocks found in the Block Editor into Gutenberg Blocks.
 *
 * @param String html HTML source before conversion.
 * @returns {Promise<any> | Promise}
 */
export function dispatchConvertClassicToBlocks( html ) {
	return new Promise( function( resolve, reject ) {
		select( 'core/block-editor' )
			.getBlocks()
			.forEach( function( block, blockIndex ) {
				if ( block.name === 'core/freeform' ) {
					dispatch( 'core/editor' ).replaceBlocks(
						block.clientId,
						rawHandler( {
							HTML: getBlockContent( block ),
						} )
					);
				}
			} );
		resolve( html );
	} );
}

/**
 * Fetches all blocks' contents from the Block Editor.
 *
 * TODO: getEditedPostContent() works only on select("core/editor") but not on select("core/block-editor") -- might be deprecated; find another approach to do this.
 *
 * @param Int postId
 * @param String html HTML source before conversion.
 * @returns {Promise<any> | Promise}
 */
export function getAllBlocksContents( postId, html ) {
	return new Promise( function( resolve, reject ) {
		const allBlocksContents = select( 'core/editor' ).getEditedPostContent();
		resolve( [ allBlocksContents, html ] );
	} );
}

/**
 * Updates Post content.
 *
 * @param int postId
 * @param string blocks Blocks Post content.
 * @param string html   HTML source before conversion.
 * @returns {*}
 */
export function updatePost( postId, blocks, html ) {
	if ( ! blocks ) {
		throw new Error( 'No resulting blocks content.' );
	}
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/update-post',
		method: 'POST',
		data: {
			post_id: postId,
			content_blocks: blocks,
			content_html: html,
		},
	} ).then( response => Promise.resolve( response ) );
}

export function fetchConversionBatch() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/get-batch-data',
	} ).then( response => Promise.resolve( response ) );
}

export function fetchSettingsInfo() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/settings/get-info',
	} ).then( response => Promise.resolve( response ) );
}

export function fetchRestoreInfo() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/restore/get-info',
	} ).then( response => Promise.resolve( response ) );
}

export function fetchConversionInfo() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/get-info',
	} ).then( response => Promise.resolve( response ) );
}

export function fetchPrepareConversion() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/prepare',
	} ).then( response => Promise.resolve( response ) );
}

export function fetchResetConversion() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/reset',
	} ).then( response => Promise.resolve( response ) );
}

/**
 * Restores post contents.
 * @returns {Promise<any> | Promise}
 */
export function fetchRestorePostContents( postIds ) {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/restore/restore-post-contents',
		method: 'POST',
		data: {
			post_ids: postIds,
		},
	} ).then( response => Promise.resolve( response ) );
}

/**
 * Flush all meta backups.
 * @returns {Promise<any> | Promise}
 */
export function fetchFlushAllMetaBackups() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/flush-all-meta-backups',
	} ).then( response => Promise.resolve( response ) );
}

export function downloadListConvertedIds() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/get-all-converted-ids',
	} ).then( response => {
		console.log(response);
		if ( response && response.ids ) {
			// Create a Blob from the CSV content with an URL.
			const blob = new Blob([response.ids], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);

			// Create a temporary anchor element with URL and filename.
			const link = document.createElement('a');
			link.href = url;
			link.download = 'converted_ids.csv';

			// Click the anchor to start download.
			link.click();

			// Clean up.
			URL.revokeObjectURL(url);
		}
	});
}

export function downloadListUnsuccessfullyConvertedIds() {
	return apiFetch( {
		path: NEWSPACK_CONVERTER_API_BASE_URL + '/conversion/get-all-unconverted-ids',
	} ).then( response => {
		console.log(response);
		if ( response && response.ids ) {
			// Create a Blob from the CSV content with an URL.
			const blob = new Blob([response.ids], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);

			// Create a temporary anchor element with URL and filename.
			const link = document.createElement('a');
			link.href = url;
			link.download = 'unconverted_ids.csv';

			// Click the anchor to start download.
			link.click();

			// Clean up.
			URL.revokeObjectURL(url);
		}
	});
}

export default {
	runSinglePost,
	runMultiplePosts,
	fetchConversionBatch,
	fetchSettingsInfo,
	fetchRestoreInfo,
	fetchConversionInfo,
	fetchPrepareConversion,
	fetchResetConversion,
	fetchRestorePostContents,
	downloadListConvertedIds,
};
