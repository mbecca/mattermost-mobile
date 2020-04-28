// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Image,
    Linking,
    Platform,
    StyleSheet,
    StatusBar,
} from 'react-native';
import {YouTubeStandaloneAndroid, YouTubeStandaloneIOS} from 'react-native-youtube';
import {intlShape} from 'react-intl';

import ImageViewPort from '@components/image_viewport';
import PostAttachmentImage from '@components/post_attachment_image';
import ProgressiveImage from '@components/progressive_image';
import TouchableWithFeedback from '@components/touchable_with_feedback';
import CustomPropTypes from '@constants/custom_prop_types';
import EventEmitter from '@mm-redux/utils/event_emitter';
import {calculateDimensions, getViewPortWidth, previewImageAtIndex} from '@utils/images';
import {getYouTubeVideoId, isImageLink, isYoutubeLink} from '@utils/url';

const MAX_YOUTUBE_IMAGE_HEIGHT = 202;
const MAX_YOUTUBE_IMAGE_WIDTH = 360;
const MAX_IMAGE_HEIGHT = 150;
let MessageAttachments;
let PostAttachmentOpenGraph;

export default class PostBodyAdditionalContent extends ImageViewPort {
    static propTypes = {
        actions: PropTypes.shape({
            getRedirectLocation: PropTypes.func.isRequired,
        }).isRequired,
        link: PropTypes.string.isRequired,
        message: PropTypes.string.isRequired,
        deviceHeight: PropTypes.number.isRequired,
        deviceWidth: PropTypes.number.isRequired,
        postId: PropTypes.string.isRequired,
        postProps: PropTypes.object.isRequired,
        showLinkPreviews: PropTypes.bool.isRequired,
        theme: PropTypes.object.isRequired,
        baseTextStyle: CustomPropTypes.Style,
        blockStyles: PropTypes.object,
        googleDeveloperKey: PropTypes.string,
        metadata: PropTypes.object,
        isReplyPost: PropTypes.bool,
        onHashtagPress: PropTypes.func,
        onPermalinkPress: PropTypes.func,
        openGraphData: PropTypes.object,
        textStyles: PropTypes.object,
        expandedLink: PropTypes.string,
    };

    static contextTypes = {
        intl: intlShape.isRequired,
    };

    constructor(props) {
        super(props);

        let dimensions = {
            height: 0,
            width: 0,
        };

        if (this.isImage() && props.metadata && props.metadata.images) {
            const img = props.metadata.images[props.link];
            if (img && img.height && img.width) {
                dimensions = calculateDimensions(img.height, img.width, getViewPortWidth(props.isReplyPost, this.hasPermanentSidebar()));
            }
        }

        this.state = {
            linkLoadError: false,
            linkLoaded: false,
            ...dimensions,
        };
    }

    componentDidMount() {
        super.componentDidMount();
        this.load();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.link !== this.props.link) {
            this.load(true);
        }
    }

    generateToggleableEmbed = (isImage, isYouTube) => {
        let {link} = this.props;
        const {expandedLink} = this.props;
        if (expandedLink) {
            link = expandedLink;
        }

        if (link) {
            if (isYouTube) {
                return this.renderYouTubeVideo(link);
            }

            if (isImage) {
                return this.renderImage(link);
            }
        }

        return null;
    };

    getImageSize = (path) => {
        const {link, metadata} = this.props;
        let img;

        if (link && path) {
            if (metadata && metadata.images) {
                img = metadata.images[link];
            }

            if (img && img.height && img.width) {
                this.setImageSize(path, img.width, img.height);
            } else {
                Image.getSize(path, (width, height) => {
                    this.setImageSize(path, width, height);
                }, () => this.setState({linkLoadError: true}));
            }
        }
    };

    getImageUrl = (link) => {
        let imageUrl;

        if (this.isImage()) {
            imageUrl = link;
        } else if (isYoutubeLink(link)) {
            const videoId = getYouTubeVideoId(link);
            imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }

        return imageUrl;
    };

    getYouTubeTime = (link) => {
        const timeRegex = /[\\?&](t|start|time_continue)=([0-9]+h)?([0-9]+m)?([0-9]+s?)/;

        const time = link.match(timeRegex);
        if (!time || !time[0]) {
            return 0;
        }

        const hours = time[2] ? time[2].match(/([0-9]+)h/) : null;
        const minutes = time[3] ? time[3].match(/([0-9]+)m/) : null;
        const seconds = time[4] ? time[4].match(/([0-9]+)s?/) : null;

        let ticks = 0;

        if (hours && hours[1]) {
            ticks += parseInt(hours[1], 10) * 3600;
        }

        if (minutes && minutes[1]) {
            ticks += parseInt(minutes[1], 10) * 60;
        }

        if (seconds && seconds[1]) {
            ticks += parseInt(seconds[1], 10);
        }

        return ticks;
    };

    handleLinkLoadError = () => {
        this.setState({linkLoadError: true});
    };

    handlePreviewImage = (imageRef) => {
        let {link} = this.props;
        const {expandedLink} = this.props;
        if (expandedLink) {
            link = expandedLink;
        }
        const {
            originalHeight,
            originalWidth,
            uri,
        } = this.state;
        const filename = link.substring(link.lastIndexOf('/') + 1, link.indexOf('?') === -1 ? link.length : link.indexOf('?'));
        const files = [{
            caption: filename,
            source: {uri},
            dimensions: {
                width: originalWidth,
                height: originalHeight,
            },
            data: {
                localPath: uri,
            },
        }];

        previewImageAtIndex([imageRef], 0, files);
    };

    isImage = (specificLink) => {
        const {metadata, link} = this.props;

        if (isImageLink(specificLink || link)) {
            return true;
        }

        if (metadata && metadata.images) {
            return Boolean(metadata.images[specificLink] || metadata.images[link]);
        }

        return false;
    };

    load = (linkChanged = false) => {
        const {link, expandedLink, actions} = this.props;

        if (link) {
            let imageUrl = this.getImageUrl(link);

            if (isYoutubeLink(link)) {
                return;
            }

            if (!imageUrl) {
                if (!expandedLink || linkChanged) {
                    actions.getRedirectLocation(link);
                } else {
                    imageUrl = this.getImageUrl(expandedLink);
                }
            }

            if (imageUrl) {
                this.getImageSize(imageUrl);
            }
        }
    };

    playYouTubeVideo = () => {
        const {link} = this.props;
        const videoId = getYouTubeVideoId(link);
        const startTime = this.getYouTubeTime(link);

        if (Platform.OS === 'ios') {
            YouTubeStandaloneIOS.
                playVideo(videoId, startTime).
                then(this.playYouTubeVideoEnded).
                catch(this.playYouTubeVideoError);
        } else {
            const {googleDeveloperKey} = this.props;

            if (googleDeveloperKey) {
                YouTubeStandaloneAndroid.playVideo({
                    apiKey: googleDeveloperKey,
                    videoId,
                    autoplay: true,
                    startTime,
                }).catch(this.playYouTubeVideoError);
            } else {
                Linking.openURL(link);
            }
        }
    };

    playYouTubeVideoEnded = () => {
        if (Platform.OS === 'ios') {
            StatusBar.setHidden(false);
            EventEmitter.emit('update_safe_area_view');
        }
    };

    playYouTubeVideoError = (errorMessage) => {
        const {formatMessage} = this.context.intl;

        Alert.alert(
            formatMessage({
                id: 'mobile.youtube_playback_error.title',
                defaultMessage: 'YouTube playback error',
            }),
            formatMessage({
                id: 'mobile.youtube_playback_error.description',
                defaultMessage: 'An error occurred while trying to play the YouTube video.\nDetails: {details}',
            }, {
                details: errorMessage,
            }),
        );
    };

    renderImage = (link) => {
        const imageMetadata = this.props.metadata?.images?.[link];
        const {width, height, uri} = this.state;

        return (
            <PostAttachmentImage
                height={height || MAX_IMAGE_HEIGHT}
                imageMetadata={imageMetadata}
                onImagePress={this.handlePreviewImage}
                onError={this.handleLinkLoadError}
                uri={uri}
                width={width}
            />
        );
    };

    renderMessageAttachment = () => {
        const {
            postId,
            postProps,
            baseTextStyle,
            blockStyles,
            deviceHeight,
            deviceWidth,
            metadata,
            onHashtagPress,
            onPermalinkPress,
            textStyles,
            theme,
        } = this.props;
        const {attachments} = postProps;

        if (attachments && attachments.length) {
            if (!MessageAttachments) {
                MessageAttachments = require('app/components/message_attachments').default;
            }

            return (
                <MessageAttachments
                    attachments={attachments}
                    baseTextStyle={baseTextStyle}
                    blockStyles={blockStyles}
                    deviceHeight={deviceHeight}
                    deviceWidth={deviceWidth}
                    metadata={metadata}
                    postId={postId}
                    textStyles={textStyles}
                    theme={theme}
                    onHashtagPress={onHashtagPress}
                    onPermalinkPress={onPermalinkPress}
                />
            );
        }

        return null;
    };

    renderOpenGraph = (isYouTube, isImage) => {
        const {isReplyPost, link, metadata, openGraphData, showLinkPreviews, theme} = this.props;

        if (isYouTube || (isImage && !openGraphData)) {
            return null;
        }

        const attachments = this.renderMessageAttachment();
        if (attachments) {
            return attachments;
        }

        if (!openGraphData && metadata) {
            return null;
        }

        if (link && showLinkPreviews) {
            if (!PostAttachmentOpenGraph) {
                PostAttachmentOpenGraph = require('app/components/post_attachment_opengraph').default;
            }

            return (
                <PostAttachmentOpenGraph
                    isReplyPost={isReplyPost}
                    link={link}
                    openGraphData={openGraphData}
                    imagesMetadata={metadata && metadata.images}
                    theme={theme}
                />
            );
        }

        return null;
    };

    renderYouTubeVideo = (link) => {
        const videoId = getYouTubeVideoId(link);
        const dimensions = calculateDimensions(
            MAX_YOUTUBE_IMAGE_HEIGHT,
            MAX_YOUTUBE_IMAGE_WIDTH,
            getViewPortWidth(this.props.isReplyPost, this.hasPermanentSidebar()),
        );
        const imgUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return (
            <TouchableWithFeedback
                style={[styles.imageContainer, {height: dimensions.height}]}
                onPress={this.playYouTubeVideo}
                type={'opacity'}
            >
                <ProgressiveImage
                    isBackgroundImage={true}
                    imageUri={imgUrl}
                    style={[styles.image, dimensions]}
                    resizeMode='cover'
                    onError={this.handleLinkLoadError}
                >
                    <TouchableWithFeedback
                        style={styles.playButton}
                        onPress={this.playYouTubeVideo}
                        type={'opacity'}
                    >
                        <Image
                            source={require('assets/images/icons/youtube-play-icon.png')}
                            onPress={this.playYouTubeVideo}
                        />
                    </TouchableWithFeedback>
                </ProgressiveImage>
            </TouchableWithFeedback>
        );
    }

    setImageSize = (uri, originalWidth, originalHeight) => {
        if (!this.mounted) {
            return;
        }

        if (!originalWidth && !originalHeight) {
            this.setState({linkLoadError: true});
            return;
        }

        const {isReplyPost, link} = this.props;
        const viewPortWidth = getViewPortWidth(isReplyPost, this.hasPermanentSidebar());

        let dimensions;
        if (isYoutubeLink(link)) {
            dimensions = calculateDimensions(MAX_YOUTUBE_IMAGE_HEIGHT, MAX_YOUTUBE_IMAGE_WIDTH, viewPortWidth);
        } else {
            dimensions = calculateDimensions(originalHeight, originalWidth, viewPortWidth);
        }

        this.setState({
            ...dimensions,
            originalHeight,
            originalWidth,
            linkLoaded: true,
            uri,
        });
    };

    render() {
        let {link} = this.props;
        const {openGraphData, postProps, expandedLink} = this.props;
        const {linkLoadError} = this.state;
        if (expandedLink) {
            link = expandedLink;
        }
        const {attachments} = postProps;

        if (!link && !attachments) {
            return null;
        }

        const isYouTube = isYoutubeLink(link);
        const isImage = this.isImage(link);
        const isOpenGraph = Boolean(openGraphData);

        if (((isImage && !isOpenGraph) || isYouTube) && !linkLoadError) {
            const embed = this.generateToggleableEmbed(isImage, isYouTube);
            if (embed) {
                return embed;
            }
        }

        return this.renderOpenGraph(isYouTube, isImage && !linkLoadError);
    }
}

const styles = StyleSheet.create({
    imageContainer: {
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        marginBottom: 6,
        marginTop: 10,
    },
    image: {
        alignItems: 'center',
        borderRadius: 3,
        justifyContent: 'center',
        marginVertical: 1,
    },
    playButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
