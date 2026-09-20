#ifndef LITECAD_LIBREDWG_BRIDGE_H
#define LITECAD_LIBREDWG_BRIDGE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    float x;
    float y;
} LiteCADPoint2D;

typedef struct {
    LiteCADPoint2D start;
    LiteCADPoint2D end;
    uint16_t layer_id;
    uint16_t color_index;
    uint32_t color_rgb;
} LiteCADLine;

typedef enum {
    LITECAD_TEXT_KIND_TEXT = 0,
    LITECAD_TEXT_KIND_MTEXT = 1,
    LITECAD_TEXT_KIND_DIMENSION = 2
} LiteCADTextKind;

typedef struct {
    LiteCADPoint2D position;
    float height;
    float rotation;
    float width_factor;
    uint16_t layer_id;
    LiteCADTextKind kind;
    uint8_t horizontal_alignment;
    uint8_t vertical_alignment;
    uint8_t attachment;
    /* Valid only during the synchronous callback. */
    const char *text;
} LiteCADTextAnnotation;

typedef struct {
    uint16_t id;
    uint16_t color_index;
    uint32_t color_rgb;
    uint16_t line_weight;
    uint8_t line_type;
    /* Valid only during the synchronous callback. */
    const char *name;
} LiteCADLayer;

typedef struct {
    const LiteCADPoint2D *points;
    uint32_t point_count;
    uint16_t layer_id;
    uint16_t color_index;
    uint32_t color_rgb;
    uint8_t is_hole;
} LiteCADFillPolygon;

typedef struct {
    void (*append_layer)(void *context, const LiteCADLayer *layer);
    void (*append_fill)(void *context, const LiteCADFillPolygon *fill);
    void (*begin_block_definition)(void *context, uint32_t definition_id, const char *name);
    void (*append_line)(void *context, const LiteCADLine *line);
    void (*append_text)(void *context, const LiteCADTextAnnotation *annotation);
    void (*end_block_definition)(void *context, uint32_t definition_id);
    void (*append_root_line)(void *context, const LiteCADLine *line);
    void (*append_root_text)(void *context, const LiteCADTextAnnotation *annotation);
    void (*append_block_instance)(
        void *context,
        uint32_t definition_id,
        float a,
        float b,
        float c,
        float d,
        float tx,
        float ty,
        uint16_t layer_id
    );
} LiteCADDocumentCallbacks;

typedef enum {
    LITECAD_STATUS_OK = 0,
    LITECAD_STATUS_INVALID_ARGUMENT = 1,
    LITECAD_STATUS_UNSUPPORTED_VERSION = 2,
    LITECAD_STATUS_PARSE_ERROR = 3,
    LITECAD_STATUS_CALLBACK_ERROR = 4
} LiteCADStatus;

/*
 * Callbacks are synchronous. The bridge owns no callback memory and must not
 * retain callback pointers or callback payload pointers after return. The
 * DWG remains at `path`; the bridge does not copy the whole file into Swift.
 */
LiteCADStatus litecad_read_dwg_file(
    const char *path,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    char *error_message,
    size_t error_capacity
);

const char *litecad_libredwg_version(void);

#ifdef __cplusplus
}
#endif

#endif
