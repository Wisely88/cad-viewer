#include "LibreDWGBridge.h"

#include <dwg.h>
#include <dwg_api.h>
#include <bits.h>

#include <float.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846264338327950288
#endif

#define LITECAD_CURVE_STEP (M_PI / 24.0)

typedef struct {
    Dwg_Object *object;
    uint32_t id;
} LiteCADBlockEntry;

typedef struct {
    LiteCADBlockEntry *entries;
    size_t count;
} LiteCADBlockMap;

typedef struct {
    double a;
    double b;
    double c;
    double d;
    double tx;
    double ty;
} LiteCADTransform;

static const LiteCADTransform LITECAD_IDENTITY_TRANSFORM = {
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0
};

static uint16_t entity_layer_id(
    const Dwg_Data *dwg,
    const Dwg_Object_Entity *entity);

static char *
decode_dwg_text(const Dwg_Data *dwg, const char *raw_text, int *owned)
{
    if (owned != NULL) {
        *owned = 0;
    }
    if (raw_text == NULL) {
        return NULL;
    }
    if (dwg != NULL && dwg->header.version >= R_2007) {
        if (owned != NULL) {
            *owned = 1;
        }
        return bit_convert_TU((BITCODE_TU)raw_text);
    }
    return (char *)raw_text;
}

static LiteCADPoint2D
transform_point(const LiteCADTransform *transform, double x, double y)
{
    LiteCADPoint2D result;
    if (transform == NULL) {
        result.x = (float)x;
        result.y = (float)y;
        return result;
    }
    result.x = (float)(transform->a * x + transform->c * y + transform->tx);
    result.y = (float)(transform->b * x + transform->d * y + transform->ty);
    return result;
}

static void
set_error(char *message, size_t capacity, const char *text)
{
    if (message == NULL || capacity == 0) {
        return;
    }
    snprintf(message, capacity, "%s", text);
}

static int
finite_float(double value, float *result)
{
    if (!isfinite(value) || value < -FLT_MAX || value > FLT_MAX) {
        return 0;
    }
    *result = (float)value;
    return 1;
}

static LiteCADStatus
emit_line(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    float x1,
    float y1,
    float x2,
    float y2,
    uint16_t layer_id)
{
    LiteCADLine line;
    line.start.x = x1;
    line.start.y = y1;
    line.end.x = x2;
    line.end.y = y2;
    line.layer_id = layer_id;
    line.color_index = 0;
    line.color_rgb = 0;

    if (in_definition) {
        callbacks->append_line(context, &line);
    } else {
        callbacks->append_root_line(context, &line);
    }
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_line_doubles(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    double x1,
    double y1,
    double x2,
    double y2,
    uint16_t layer_id)
{
    float fx1, fy1, fx2, fy2;
    if (transform != NULL) {
        LiteCADPoint2D start = transform_point(transform, x1, y1);
        LiteCADPoint2D end = transform_point(transform, x2, y2);
        x1 = start.x;
        y1 = start.y;
        x2 = end.x;
        y2 = end.y;
    }
    if (!finite_float(x1, &fx1) || !finite_float(y1, &fy1)
        || !finite_float(x2, &fx2) || !finite_float(y2, &fy2)) {
        return LITECAD_STATUS_PARSE_ERROR;
    }
    return emit_line(
        callbacks, context, in_definition, fx1, fy1, fx2, fy2, layer_id);
}

static LiteCADStatus
emit_text(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    double x,
    double y,
    double height,
    double rotation,
    double width_factor,
    uint16_t layer_id,
    LiteCADTextKind kind,
    uint8_t horizontal_alignment,
    uint8_t vertical_alignment,
    uint8_t attachment,
    const char *text)
{
    LiteCADTextAnnotation annotation;
    float fx, fy, fheight, frotation, fwidth;

    if (text == NULL || text[0] == '\0') {
        return LITECAD_STATUS_OK;
    }
    if (transform != NULL) {
        LiteCADPoint2D position = transform_point(transform, x, y);
        double scale = hypot(transform->a, transform->b);
        x = position.x;
        y = position.y;
        height *= scale;
        rotation += atan2(transform->b, transform->a);
    }
    if (!finite_float(x, &fx) || !finite_float(y, &fy)
        || !finite_float(height, &fheight) || !finite_float(rotation, &frotation)
        || !isfinite(width_factor)) {
        return LITECAD_STATUS_PARSE_ERROR;
    }
    if (fheight <= 0.0f) {
        return LITECAD_STATUS_OK;
    }
    if (width_factor <= 0.0) {
        width_factor = 1.0;
    }
    if (!finite_float(width_factor, &fwidth)) {
        return LITECAD_STATUS_PARSE_ERROR;
    }

    annotation.position.x = fx;
    annotation.position.y = fy;
    annotation.height = fheight;
    annotation.rotation = frotation;
    annotation.width_factor = fwidth;
    annotation.layer_id = layer_id;
    annotation.kind = kind;
    annotation.horizontal_alignment = horizontal_alignment;
    annotation.vertical_alignment = vertical_alignment;
    annotation.attachment = attachment;
    annotation.text = text;
    if (in_definition) {
        callbacks->append_text(context, &annotation);
    } else {
        callbacks->append_root_text(context, &annotation);
    }
    return LITECAD_STATUS_OK;
}

static int
is_dimension_type(int fixedtype)
{
    switch (fixedtype) {
    case DWG_TYPE_DIMENSION_LINEAR:
    case DWG_TYPE_DIMENSION_ALIGNED:
    case DWG_TYPE_DIMENSION_ANG3PT:
    case DWG_TYPE_DIMENSION_ANG2LN:
    case DWG_TYPE_DIMENSION_RADIUS:
    case DWG_TYPE_DIMENSION_DIAMETER:
    case DWG_TYPE_DIMENSION_ORDINATE:
        return 1;
    default:
        return 0;
    }
}

static LiteCADStatus
emit_dimension_graphics(
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    uint16_t layer_id)
{
    Dwg_DIMENSION_common *common;
    double ux, uy, nx, ny;

    if (object == NULL || object->tio.entity == NULL
        || object->tio.entity->tio.DIMENSION_common == NULL) {
        return LITECAD_STATUS_OK;
    }
    common = object->tio.entity->tio.DIMENSION_common;

    switch (object->fixedtype) {
    case DWG_TYPE_DIMENSION_LINEAR: {
        Dwg_Entity_DIMENSION_LINEAR *dimension =
            object->tio.entity->tio.DIMENSION_LINEAR;
        double x1 = dimension->xline1_pt.x;
        double y1 = dimension->xline1_pt.y;
        double x2 = dimension->xline2_pt.x;
        double y2 = dimension->xline2_pt.y;
        ux = cos(dimension->dim_rotation);
        uy = sin(dimension->dim_rotation);
        if (!isfinite(ux) || !isfinite(uy) || hypot(ux, uy) < DBL_EPSILON) {
            ux = x2 - x1;
            uy = y2 - y1;
            {
                double length = hypot(ux, uy);
                if (length < DBL_EPSILON) return LITECAD_STATUS_OK;
                ux /= length;
                uy /= length;
            }
        }
        nx = -uy;
        ny = ux;
        break;
    }
    case DWG_TYPE_DIMENSION_ALIGNED: {
        Dwg_Entity_DIMENSION_ALIGNED *dimension =
            object->tio.entity->tio.DIMENSION_ALIGNED;
        double x1 = dimension->xline1_pt.x;
        double y1 = dimension->xline1_pt.y;
        double x2 = dimension->xline2_pt.x;
        double y2 = dimension->xline2_pt.y;
        double length = hypot(x2 - x1, y2 - y1);
        if (length < DBL_EPSILON) return LITECAD_STATUS_OK;
        ux = (x2 - x1) / length;
        uy = (y2 - y1) / length;
        nx = -uy;
        ny = ux;
        break;
    }
    case DWG_TYPE_DIMENSION_RADIUS:
    case DWG_TYPE_DIMENSION_DIAMETER: {
        Dwg_Entity_DIMENSION_RADIUS *dimension =
            object->fixedtype == DWG_TYPE_DIMENSION_RADIUS
                ? object->tio.entity->tio.DIMENSION_RADIUS
                : (Dwg_Entity_DIMENSION_RADIUS *)object->tio.entity->tio.DIMENSION_DIAMETER;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->first_arc_pt.x, dimension->first_arc_pt.y,
            common->text_midpt.x, common->text_midpt.y, layer_id);
    }
    case DWG_TYPE_DIMENSION_ANG3PT: {
        Dwg_Entity_DIMENSION_ANG3PT *dimension =
            object->tio.entity->tio.DIMENSION_ANG3PT;
        LiteCADStatus status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->center_pt.x, dimension->center_pt.y,
            dimension->xline1_pt.x, dimension->xline1_pt.y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->center_pt.x, dimension->center_pt.y,
            dimension->xline2_pt.x, dimension->xline2_pt.y, layer_id);
    }
    case DWG_TYPE_DIMENSION_ANG2LN: {
        Dwg_Entity_DIMENSION_ANG2LN *dimension =
            object->tio.entity->tio.DIMENSION_ANG2LN;
        LiteCADStatus status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->xline1start_pt.x, dimension->xline1start_pt.y,
            dimension->xline1end_pt.x, dimension->xline1end_pt.y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->xline2start_pt.x, dimension->xline2start_pt.y,
            dimension->xline2end_pt.x, dimension->xline2end_pt.y, layer_id);
    }
    case DWG_TYPE_DIMENSION_ORDINATE: {
        Dwg_Entity_DIMENSION_ORDINATE *dimension =
            object->tio.entity->tio.DIMENSION_ORDINATE;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            dimension->feature_location_pt.x, dimension->feature_location_pt.y,
            dimension->leader_endpt.x, dimension->leader_endpt.y, layer_id);
    }
    default:
        return LITECAD_STATUS_OK;
    }

    {
        double p1x;
        double p1y;
        double p2x;
        double p2y;
        double projection1;
        double projection2;
        double arrow_size;
        LiteCADStatus status;

        if (object->fixedtype == DWG_TYPE_DIMENSION_LINEAR) {
            Dwg_Entity_DIMENSION_LINEAR *dimension =
                object->tio.entity->tio.DIMENSION_LINEAR;
            p1x = dimension->xline1_pt.x;
            p1y = dimension->xline1_pt.y;
            p2x = dimension->xline2_pt.x;
            p2y = dimension->xline2_pt.y;
        } else {
            Dwg_Entity_DIMENSION_ALIGNED *dimension =
                object->tio.entity->tio.DIMENSION_ALIGNED;
            p1x = dimension->xline1_pt.x;
            p1y = dimension->xline1_pt.y;
            p2x = dimension->xline2_pt.x;
            p2y = dimension->xline2_pt.y;
        }
        projection1 = (p1x - common->text_midpt.x) * ux
            + (p1y - common->text_midpt.y) * uy;
        projection2 = (p2x - common->text_midpt.x) * ux
            + (p2y - common->text_midpt.y) * uy;
        p1x = common->text_midpt.x + projection1 * ux;
        p1y = common->text_midpt.y + projection1 * uy;
        p2x = common->text_midpt.x + projection2 * ux;
        p2y = common->text_midpt.y + projection2 * uy;
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            p1x, p1y, p2x, p2y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            object->fixedtype == DWG_TYPE_DIMENSION_LINEAR
                ? ((Dwg_Entity_DIMENSION_LINEAR *)object->tio.entity->tio.DIMENSION_LINEAR)->xline1_pt.x
                : ((Dwg_Entity_DIMENSION_ALIGNED *)object->tio.entity->tio.DIMENSION_ALIGNED)->xline1_pt.x,
            object->fixedtype == DWG_TYPE_DIMENSION_LINEAR
                ? ((Dwg_Entity_DIMENSION_LINEAR *)object->tio.entity->tio.DIMENSION_LINEAR)->xline1_pt.y
                : ((Dwg_Entity_DIMENSION_ALIGNED *)object->tio.entity->tio.DIMENSION_ALIGNED)->xline1_pt.y,
            p1x, p1y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            object->fixedtype == DWG_TYPE_DIMENSION_LINEAR
                ? ((Dwg_Entity_DIMENSION_LINEAR *)object->tio.entity->tio.DIMENSION_LINEAR)->xline2_pt.x
                : ((Dwg_Entity_DIMENSION_ALIGNED *)object->tio.entity->tio.DIMENSION_ALIGNED)->xline2_pt.x,
            object->fixedtype == DWG_TYPE_DIMENSION_LINEAR
                ? ((Dwg_Entity_DIMENSION_LINEAR *)object->tio.entity->tio.DIMENSION_LINEAR)->xline2_pt.y
                : ((Dwg_Entity_DIMENSION_ALIGNED *)object->tio.entity->tio.DIMENSION_ALIGNED)->xline2_pt.y,
            p2x, p2y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        arrow_size = fmax(hypot(p2x - p1x, p2y - p1y) * 0.04, 0.1);
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            p1x, p1y, p1x + ux * arrow_size + nx * arrow_size * 0.5,
            p1y + uy * arrow_size + ny * arrow_size * 0.5, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            p1x, p1y, p1x + ux * arrow_size - nx * arrow_size * 0.5,
            p1y + uy * arrow_size - ny * arrow_size * 0.5, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            p2x, p2y, p2x - ux * arrow_size + nx * arrow_size * 0.5,
            p2y - uy * arrow_size + ny * arrow_size * 0.5, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            p2x, p2y, p2x - ux * arrow_size - nx * arrow_size * 0.5,
            p2y - uy * arrow_size - ny * arrow_size * 0.5, layer_id);
    }
}

static LiteCADStatus
emit_dimension(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform)
{
    Dwg_DIMENSION_common *dimension = object->tio.entity->tio.DIMENSION_common;
    uint16_t layer_id = entity_layer_id(dwg, object->tio.entity);
    char generated_text[64];
    const char *text;
    char *decoded_text = NULL;
    int decoded_text_owned = 0;
    double height = 1.0;

    if (dimension == NULL) {
        return LITECAD_STATUS_OK;
    }
    decoded_text = decode_dwg_text(
        dwg, dimension->user_text, &decoded_text_owned);
    text = decoded_text;
    if (text == NULL || text[0] == '\0') {
        if (isfinite(dimension->act_measurement)) {
            snprintf(generated_text, sizeof(generated_text), "%.2f", dimension->act_measurement);
            text = generated_text;
        } else {
            return LITECAD_STATUS_OK;
        }
    }
    if (isfinite(dimension->act_measurement)) {
        height = fmin(fmax(fabs(dimension->act_measurement) * 0.02, 0.1), 100.0);
    }
    LiteCADStatus status = emit_text(
        callbacks,
        context,
        in_definition,
        transform,
        dimension->text_midpt.x,
        dimension->text_midpt.y,
        height,
        dimension->text_rotation,
        1.0,
        layer_id,
        LITECAD_TEXT_KIND_DIMENSION,
        1,
        2,
        0,
        text);
    if (decoded_text != NULL && decoded_text_owned) {
        free(decoded_text);
    }
    if (status != LITECAD_STATUS_OK) return status;
    return emit_dimension_graphics(
        object, callbacks, context, in_definition, transform, layer_id);
}

static LiteCADStatus
emit_arc(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    double center_x,
    double center_y,
    double radius_x,
    double radius_y,
    double axis_angle,
    double start_angle,
    double end_angle,
    uint16_t layer_id)
{
    double delta = end_angle - start_angle;
    double span = fabs(delta);
    size_t segments;
    double previous_x, previous_y;
    size_t index;

    if (!isfinite(center_x) || !isfinite(center_y) || !isfinite(radius_x)
        || !isfinite(radius_y) || !isfinite(axis_angle)
        || !isfinite(start_angle) || !isfinite(end_angle)
        || radius_x < 0.0 || radius_y < 0.0 || span <= 0.0) {
        return LITECAD_STATUS_PARSE_ERROR;
    }

    segments = (size_t)ceil(span / LITECAD_CURVE_STEP);
    if (segments < 2) {
        segments = 2;
    }
    if (segments > 4096) {
        segments = 4096;
    }

    previous_x = center_x + radius_x * cos(axis_angle) * cos(start_angle)
        - radius_y * sin(axis_angle) * sin(start_angle);
    previous_y = center_y + radius_x * sin(axis_angle) * cos(start_angle)
        + radius_y * cos(axis_angle) * sin(start_angle);

    for (index = 1; index <= segments; index++) {
        double angle = start_angle + delta * (double)index / (double)segments;
        double current_x = center_x + radius_x * cos(axis_angle) * cos(angle)
            - radius_y * sin(axis_angle) * sin(angle);
        double current_y = center_y + radius_x * sin(axis_angle) * cos(angle)
            + radius_y * cos(axis_angle) * sin(angle);
        LiteCADStatus status = emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            previous_x,
            previous_y,
            current_x,
            current_y,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            return status;
        }
        previous_x = current_x;
        previous_y = current_y;
    }
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_bulged_segment(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    double x1,
    double y1,
    double x2,
    double y2,
    double bulge,
    uint16_t layer_id)
{
    double dx = x2 - x1;
    double dy = y2 - y1;
    double chord = hypot(dx, dy);

    if (!isfinite(bulge) || chord <= DBL_EPSILON) {
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            x1, y1, x2, y2, layer_id);
    }
    if (fabs(bulge) <= 1e-12) {
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            x1, y1, x2, y2, layer_id);
    }

    {
        double theta = 4.0 * atan(bulge);
        double offset = chord / (2.0 * tan(theta / 2.0));
        double center_x = (x1 + x2) / 2.0 - dy * offset / chord;
        double center_y = (y1 + y2) / 2.0 + dx * offset / chord;
        double start_angle = atan2(y1 - center_y, x1 - center_x);
        return emit_arc(
            callbacks,
            context,
            in_definition,
            transform,
            center_x,
            center_y,
            hypot(x1 - center_x, y1 - center_y),
            hypot(x1 - center_x, y1 - center_y),
            0.0,
            start_angle,
            start_angle + theta,
            layer_id);
    }
}

static LiteCADStatus
emit_quad(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    double x1,
    double y1,
    double x2,
    double y2,
    double x3,
    double y3,
    double x4,
    double y4,
    uint16_t layer_id)
{
    LiteCADStatus status = emit_line_doubles(
        callbacks, context, in_definition, transform, x1, y1, x2, y2, layer_id);
    if (status != LITECAD_STATUS_OK) return status;
    status = emit_line_doubles(
        callbacks, context, in_definition, transform, x2, y2, x3, y3, layer_id);
    if (status != LITECAD_STATUS_OK) return status;
    status = emit_line_doubles(
        callbacks, context, in_definition, transform, x3, y3, x4, y4, layer_id);
    if (status != LITECAD_STATUS_OK) return status;
    return emit_line_doubles(
        callbacks, context, in_definition, transform, x4, y4, x1, y1, layer_id);
}

static LiteCADStatus
emit_fill_polygon(
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    const Dwg_HATCH_Path *path,
    uint16_t layer_id)
{
    BITCODE_BL count;
    LiteCADPoint2D *points;
    LiteCADFillPolygon fill;
    BITCODE_BL index;

    if (callbacks == NULL || callbacks->append_fill == NULL || path == NULL
        || path->polyline_paths == NULL || path->num_segs_or_paths < 3
        || path->closed == 0 || (path->flag & 0x20) != 0) {
        return LITECAD_STATUS_OK;
    }
    count = path->num_segs_or_paths;
    points = (LiteCADPoint2D *)calloc((size_t)count, sizeof(*points));
    if (points == NULL) {
        return LITECAD_STATUS_CALLBACK_ERROR;
    }
    for (index = 0; index < count; index++) {
        points[index] = transform_point(
            transform,
            path->polyline_paths[index].point.x,
            path->polyline_paths[index].point.y);
    }
    fill.points = points;
    fill.point_count = (uint32_t)count;
    fill.layer_id = layer_id;
    fill.color_index = 0;
    fill.color_rgb = 0;
    fill.is_hole = (path->flag & 0x80) != 0;
    callbacks->append_fill(context, &fill);
    free(points);
    (void)in_definition;
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_hatch(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform)
{
    Dwg_Entity_HATCH *hatch = object->tio.entity->tio.HATCH;
    uint16_t layer_id = entity_layer_id(dwg, object->tio.entity);
    BITCODE_BL path_index;

    if (hatch == NULL || hatch->paths == NULL || hatch->num_paths <= 0) {
        return LITECAD_STATUS_OK;
    }

    for (path_index = 0; path_index < hatch->num_paths; path_index++) {
        Dwg_HATCH_Path *path = &hatch->paths[path_index];
        if ((path->flag & 2) != 0 && path->polyline_paths != NULL) {
            BITCODE_BL count = path->num_segs_or_paths;
            BITCODE_BL index;
            if (count < 2) continue;
            for (index = 1; index < count; index++) {
                Dwg_HATCH_PolylinePath *previous = &path->polyline_paths[index - 1];
                Dwg_HATCH_PolylinePath *current = &path->polyline_paths[index];
                LiteCADStatus status = emit_bulged_segment(
                    callbacks, context, in_definition, transform,
                    previous->point.x, previous->point.y,
                    current->point.x, current->point.y,
                    previous->bulge, layer_id);
                if (status != LITECAD_STATUS_OK) return status;
            }
            if (path->closed) {
                Dwg_HATCH_PolylinePath *last = &path->polyline_paths[count - 1];
                Dwg_HATCH_PolylinePath *first = &path->polyline_paths[0];
                LiteCADStatus status = emit_bulged_segment(
                    callbacks, context, in_definition, transform,
                    last->point.x, last->point.y,
                    first->point.x, first->point.y,
                    last->bulge, layer_id);
                if (status != LITECAD_STATUS_OK) return status;
            }
            {
                LiteCADStatus status = emit_fill_polygon(
                    callbacks, context, in_definition, transform,
                    path, layer_id);
                if (status != LITECAD_STATUS_OK) return status;
            }
            continue;
        }

        if (path->segs == NULL) continue;
        for (BITCODE_BL index = 0; index < path->num_segs_or_paths; index++) {
            Dwg_HATCH_PathSeg *segment = &path->segs[index];
            switch (segment->curve_type) {
            case 1:
                if (emit_line_doubles(
                        callbacks, context, in_definition, transform,
                        segment->first_endpoint.x, segment->first_endpoint.y,
                        segment->second_endpoint.x, segment->second_endpoint.y,
                        layer_id) != LITECAD_STATUS_OK) {
                    return LITECAD_STATUS_PARSE_ERROR;
                }
                break;
            case 2: {
                double start = segment->start_angle;
                double end = segment->end_angle;
                if (!segment->is_ccw) {
                    double swap = start;
                    start = end;
                    end = swap;
                }
                LiteCADStatus status = emit_arc(
                    callbacks, context, in_definition, transform,
                    segment->center.x, segment->center.y,
                    segment->radius, segment->radius, 0.0,
                    start, end, layer_id);
                if (status != LITECAD_STATUS_OK) return status;
                break;
            }
            case 3: {
                double radius_x = hypot(segment->endpoint.x, segment->endpoint.y);
                double start = segment->start_angle;
                double end = segment->end_angle;
                if (!segment->is_ccw) {
                    double swap = start;
                    start = end;
                    end = swap;
                }
                LiteCADStatus status = emit_arc(
                    callbacks, context, in_definition, transform,
                    segment->center.x, segment->center.y,
                    radius_x, radius_x * segment->minor_major_ratio,
                    atan2(segment->endpoint.y, segment->endpoint.x),
                    start, end, layer_id);
                if (status != LITECAD_STATUS_OK) return status;
                break;
            }
            case 4:
                if (segment->fitpts != NULL && segment->num_fitpts > 1) {
                    for (BITCODE_BL point = 1; point < segment->num_fitpts; point++) {
                        LiteCADStatus status = emit_line_doubles(
                            callbacks, context, in_definition, transform,
                            segment->fitpts[point - 1].x, segment->fitpts[point - 1].y,
                            segment->fitpts[point].x, segment->fitpts[point].y,
                            layer_id);
                        if (status != LITECAD_STATUS_OK) return status;
                    }
                }
                break;
            default:
                break;
            }
        }
    }
    return LITECAD_STATUS_OK;
}

static uint16_t
entity_layer_id(const Dwg_Data *dwg, const Dwg_Object_Entity *entity)
{
    Dwg_Object_LAYER *layer;
    Dwg_Object_LAYER **layers;
    unsigned int count;
    unsigned int index;

    if (dwg == NULL || entity == NULL) {
        return 0;
    }
    layer = dwg_get_entity_layer(entity);
    layers = dwg_get_layers(dwg);
    count = dwg_get_layer_count(dwg);
    if (layer == NULL || layers == NULL) {
        return 0;
    }
    for (index = 0; index < count && index < UINT16_MAX; index++) {
        if (layers[index] == layer) {
            return (uint16_t)index;
        }
    }
    return 0;
}

static LiteCADStatus
emit_layers(
    const Dwg_Data *dwg,
    const LiteCADDocumentCallbacks *callbacks,
    void *context)
{
    Dwg_Object_LAYER **layers;
    unsigned int count;
    unsigned int index;

    if (dwg == NULL || callbacks == NULL || callbacks->append_layer == NULL) {
        return LITECAD_STATUS_OK;
    }
    layers = dwg_get_layers(dwg);
    count = dwg_get_layer_count(dwg);
    if (layers == NULL) {
        return LITECAD_STATUS_OK;
    }
    for (index = 0; index < count && index <= UINT16_MAX; index++) {
        Dwg_Object_LAYER *layer = layers[index];
        LiteCADLayer value;
        int owned = 0;
        char *name;
        if (layer == NULL) {
            continue;
        }
        name = decode_dwg_text(dwg, layer->name, &owned);
        value.id = (uint16_t)index;
        value.color_index = layer->color.method == DWG_COLOR_METHOD_ACI
            && layer->color.index > 0 && layer->color.index <= 255
            ? (uint16_t)layer->color.index
            : 0;
        value.color_rgb = layer->color.method == DWG_COLOR_METHOD_TRUECOLOR
            ? (layer->color.rgb & 0x00ffffffu)
            : 0;
        {
            int line_weight = dxf_cvt_lweight(layer->linewt);
            value.line_weight = line_weight > 0 && line_weight <= UINT16_MAX
                ? (uint16_t)line_weight
                : 0;
        }
        value.line_type = 0;
        if (layer->ltype != NULL && layer->ltype->obj != NULL
            && layer->ltype->obj->tio.object != NULL
            && layer->ltype->obj->tio.object->tio.LTYPE != NULL
            && layer->ltype->obj->tio.object->tio.LTYPE->name != NULL) {
            const char *line_type_name = layer->ltype->obj->tio.object->tio.LTYPE->name;
            if (strstr(line_type_name, "DASHDOT") != NULL
                || strstr(line_type_name, "CENTER") != NULL) {
                value.line_type = 3;
            } else if (strstr(line_type_name, "DOT") != NULL) {
                value.line_type = 2;
            } else if (strstr(line_type_name, "DASH") != NULL
                       || strstr(line_type_name, "HIDDEN") != NULL) {
                value.line_type = 1;
            }
        }
        value.name = name == NULL ? "" : name;
        callbacks->append_layer(context, &value);
        if (owned) {
            free(name);
        }
    }
    return LITECAD_STATUS_OK;
}

static int
block_id(const LiteCADBlockMap *map, const Dwg_Object *object, uint32_t *result)
{
    size_t index;
    if (map == NULL || object == NULL || result == NULL) {
        return 0;
    }
    for (index = 0; index < map->count; index++) {
        if (map->entries[index].object == object) {
            *result = map->entries[index].id;
            return 1;
        }
    }
    return 0;
}

static LiteCADStatus
emit_entity(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADBlockMap *map,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    unsigned int depth);

static LiteCADStatus
emit_lwpolyline(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform)
{
    Dwg_Entity_LWPOLYLINE *polyline = object->tio.entity->tio.LWPOLYLINE;
    BITCODE_BL count = polyline->num_points;
    BITCODE_2RD *points = polyline->points;
    BITCODE_BD *bulges = polyline->bulges;
    BITCODE_BS flags = polyline->flag;
    BITCODE_BL index;
    uint16_t layer_id;

    if (count < 2 || points == NULL) {
        return LITECAD_STATUS_OK;
    }
    layer_id = entity_layer_id(dwg, object->tio.entity);

    for (index = 0; index + 1 < count; index++) {
        double bulge = bulges != NULL && index < polyline->num_bulges
            ? bulges[index]
            : 0.0;
        LiteCADStatus status = emit_bulged_segment(
            callbacks,
            context,
            in_definition,
            transform,
            points[index].x,
            points[index].y,
            points[index + 1].x,
            points[index + 1].y,
            bulge,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            return status;
        }
    }
    if ((flags & 512) != 0) {
        BITCODE_BL last = count - 1;
        double bulge = bulges != NULL && last < polyline->num_bulges
            ? bulges[last]
            : 0.0;
        LiteCADStatus status = emit_bulged_segment(
            callbacks,
            context,
            in_definition,
            transform,
            points[last].x,
            points[last].y,
            points[0].x,
            points[0].y,
            bulge,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            return status;
        }
    }
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_polyline_2d(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform)
{
    Dwg_Entity_POLYLINE_2D *polyline = object->tio.entity->tio.POLYLINE_2D;
    int error = 0;
    BITCODE_BL count = dwg_object_polyline_2d_get_numpoints(object, &error);
    dwg_point_2d *points = error == 0 && count > 0
        ? dwg_object_polyline_2d_get_points(object, &error)
        : NULL;
    uint16_t layer_id = entity_layer_id(dwg, object->tio.entity);
    BITCODE_BL index;

    if (error != 0 || points == NULL || count < 2) {
        free(points);
        return LITECAD_STATUS_OK;
    }
    for (index = 1; index < count; index++) {
        LiteCADStatus status = emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            points[index - 1].x,
            points[index - 1].y,
            points[index].x,
            points[index].y,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            free(points);
            return status;
        }
    }
    if ((polyline->flag & 1) != 0) {
        LiteCADStatus status = emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            points[count - 1].x,
            points[count - 1].y,
            points[0].x,
            points[0].y,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            free(points);
            return status;
        }
    }
    free(points);
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_polyline_3d(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform)
{
    Dwg_Entity_POLYLINE_3D *polyline = object->tio.entity->tio.POLYLINE_3D;
    int error = 0;
    BITCODE_BL count = dwg_object_polyline_3d_get_numpoints(object, &error);
    dwg_point_3d *points = error == 0 && count > 0
        ? dwg_object_polyline_3d_get_points(object, &error)
        : NULL;
    uint16_t layer_id = entity_layer_id(dwg, object->tio.entity);
    BITCODE_BL index;

    if (error != 0 || points == NULL || count < 2) {
        free(points);
        return LITECAD_STATUS_OK;
    }
    for (index = 1; index < count; index++) {
        LiteCADStatus status = emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            points[index - 1].x,
            points[index - 1].y,
            points[index].x,
            points[index].y,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            free(points);
            return status;
        }
    }
    if ((polyline->flag & 1) != 0) {
        LiteCADStatus status = emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            points[count - 1].x,
            points[count - 1].y,
            points[0].x,
            points[0].y,
            layer_id);
        if (status != LITECAD_STATUS_OK) {
            free(points);
            return status;
        }
    }
    free(points);
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_insert(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADBlockMap *map,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int is_minsert,
    int in_definition,
    const LiteCADTransform *parent_transform,
    unsigned int depth)
{
    Dwg_Object *block_object;
    Dwg_Object_BLOCK_HEADER *block_header;
    uint32_t definition_id;
    int error = 0;
    double x;
    double y;
    double sx;
    double sy;
    double rotation;
    double base_x;
    double base_y;
    uint16_t layer_id = entity_layer_id(dwg, object->tio.entity);
    unsigned int rows = 1;
    unsigned int columns = 1;
    double column_spacing = 0.0;
    double row_spacing = 0.0;
    unsigned int row;
    unsigned int column;

    if (is_minsert) {
        Dwg_Entity_MINSERT *insert = object->tio.entity->tio.MINSERT;
        x = insert->ins_pt.x;
        y = insert->ins_pt.y;
        sx = insert->scale.x;
        sy = insert->scale.y;
        rotation = insert->rotation;
        rows = insert->num_rows == 0 ? 1 : insert->num_rows;
        columns = insert->num_cols == 0 ? 1 : insert->num_cols;
        column_spacing = insert->col_spacing;
        row_spacing = insert->row_spacing;
        block_object = insert->block_header == NULL
            ? NULL
            : insert->block_header->obj;
    } else {
        Dwg_Entity_INSERT *insert = object->tio.entity->tio.INSERT;
        x = insert->ins_pt.x;
        y = insert->ins_pt.y;
        sx = insert->scale.x;
        sy = insert->scale.y;
        rotation = insert->rotation;
        block_object = insert->block_header == NULL
            ? NULL
            : insert->block_header->obj;
    }
    if (error || block_object == NULL || !block_id(map, block_object, &definition_id)
        || block_object->tio.object == NULL
        || block_object->tio.object->tio.BLOCK_HEADER == NULL) {
        return LITECAD_STATUS_OK;
    }

    block_header = block_object->tio.object->tio.BLOCK_HEADER;
    base_x = block_header->base_pt.x;
    base_y = block_header->base_pt.y;

    for (row = 0; row < rows; row++) {
        for (column = 0; column < columns; column++) {
            double cosine = cos(rotation);
            double sine = sin(rotation);
            double a = cosine * sx;
            double b = sine * sx;
            double c = -sine * sy;
            double d = cosine * sy;
            double tx = x + a * (double)column * column_spacing
                + c * (double)row * row_spacing - a * base_x - c * base_y;
            double ty = y + b * (double)column * column_spacing
                + d * (double)row * row_spacing - b * base_x - d * base_y;
            LiteCADTransform local = {a, b, c, d, tx, ty};
            if (in_definition) {
                (void)parent_transform;
                (void)depth;
                callbacks->append_block_instance(
                    context,
                    definition_id,
                    (float)a,
                    (float)b,
                    (float)c,
                    (float)d,
                    (float)tx,
                    (float)ty,
                    layer_id);
            } else {
                callbacks->append_block_instance(
                    context,
                    definition_id,
                    (float)a,
                    (float)b,
                    (float)c,
                    (float)d,
                    (float)tx,
                    (float)ty,
                    layer_id);
            }
        }
    }
    return LITECAD_STATUS_OK;
}

static LiteCADStatus
emit_entity(
    const Dwg_Data *dwg,
    Dwg_Object *object,
    const LiteCADBlockMap *map,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    int in_definition,
    const LiteCADTransform *transform,
    unsigned int depth)
{
    uint16_t layer_id;

    if (object == NULL || object->tio.entity == NULL) {
        return LITECAD_STATUS_OK;
    }
    layer_id = entity_layer_id(dwg, object->tio.entity);
    switch (object->fixedtype) {
    case DWG_TYPE_LINE: {
        Dwg_Entity_LINE *line = object->tio.entity->tio.LINE;
        return emit_line_doubles(
            callbacks,
            context,
            in_definition,
            transform,
            line->start.x,
            line->start.y,
            line->end.x,
            line->end.y,
            layer_id);
    }
    case DWG_TYPE_RAY:
    case DWG_TYPE_XLINE: {
        Dwg_Entity_RAY *ray = object->tio.entity->tio.RAY;
        double vx = ray->vector.x;
        double vy = ray->vector.y;
        double length = hypot(vx, vy);
        double extent_x;
        double extent_y;
        if (!isfinite(length) || length < DBL_EPSILON) return LITECAD_STATUS_OK;
        vx /= length;
        vy /= length;
        extent_x = fabs(dwg->header_vars.EXTMAX.x - dwg->header_vars.EXTMIN.x);
        extent_y = fabs(dwg->header_vars.EXTMAX.y - dwg->header_vars.EXTMIN.y);
        length = fmin(fmax(hypot(extent_x, extent_y) * 2.0, 1000.0), 1000000.0);
        if (object->fixedtype == DWG_TYPE_XLINE) {
            return emit_line_doubles(
                callbacks, context, in_definition, transform,
                ray->point.x - vx * length, ray->point.y - vy * length,
                ray->point.x + vx * length, ray->point.y + vy * length,
                layer_id);
        }
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            ray->point.x, ray->point.y,
            ray->point.x + vx * length, ray->point.y + vy * length,
            layer_id);
    }
    case DWG_TYPE_LEADER: {
        Dwg_Entity_LEADER *leader = object->tio.entity->tio.LEADER;
        BITCODE_BL index;
        if (leader == NULL || leader->points == NULL || leader->num_points < 2) {
            return LITECAD_STATUS_OK;
        }
        for (index = 1; index < leader->num_points; index++) {
            LiteCADStatus status = emit_line_doubles(
                callbacks, context, in_definition, transform,
                leader->points[index - 1].x, leader->points[index - 1].y,
                leader->points[index].x, leader->points[index].y,
                layer_id);
            if (status != LITECAD_STATUS_OK) return status;
        }
        if (leader->arrowhead_on) {
            BITCODE_3DPOINT *tip = &leader->points[0];
            BITCODE_3DPOINT *next = &leader->points[1];
            double dx = next->x - tip->x;
            double dy = next->y - tip->y;
            double segment_length = hypot(dx, dy);
            if (segment_length > DBL_EPSILON) {
                double ux = dx / segment_length;
                double uy = dy / segment_length;
                double arrow = fmax(leader->dimasz, segment_length * 0.08);
                double nx = -uy;
                double ny = ux;
                LiteCADStatus status = emit_line_doubles(
                    callbacks, context, in_definition, transform,
                    tip->x, tip->y,
                    tip->x + ux * arrow + nx * arrow * 0.5,
                    tip->y + uy * arrow + ny * arrow * 0.5,
                    layer_id);
                if (status != LITECAD_STATUS_OK) return status;
                return emit_line_doubles(
                    callbacks, context, in_definition, transform,
                    tip->x, tip->y,
                    tip->x + ux * arrow - nx * arrow * 0.5,
                    tip->y + uy * arrow - ny * arrow * 0.5,
                    layer_id);
            }
        }
        return LITECAD_STATUS_OK;
    }
    case DWG_TYPE_LWPOLYLINE:
        return emit_lwpolyline(
            dwg, object, callbacks, context, in_definition, transform);
    case DWG_TYPE_POLYLINE_2D:
        return emit_polyline_2d(
            dwg, object, callbacks, context, in_definition, transform);
    case DWG_TYPE_POLYLINE_3D:
        return emit_polyline_3d(
            dwg, object, callbacks, context, in_definition, transform);
    case DWG_TYPE_TEXT: {
        Dwg_Entity_TEXT *text = object->tio.entity->tio.TEXT;
        int decoded_text_owned = 0;
        double text_x = text->ins_pt.x;
        double text_y = text->ins_pt.y;
        if (text->horiz_alignment != 0 || text->vert_alignment != 0) {
            text_x = text->alignment_pt.x;
            text_y = text->alignment_pt.y;
        }
        char *decoded_text = decode_dwg_text(
            dwg, text->text_value, &decoded_text_owned);
        if (decoded_text == NULL) {
            return LITECAD_STATUS_OK;
        }
        LiteCADStatus status = emit_text(
            callbacks,
            context,
            in_definition,
            transform,
            text_x,
            text_y,
            text->height,
            text->rotation,
            text->width_factor,
            layer_id,
            LITECAD_TEXT_KIND_TEXT,
            (uint8_t)text->horiz_alignment,
            (uint8_t)text->vert_alignment,
            0,
            decoded_text);
        if (decoded_text_owned) {
            free(decoded_text);
        }
        return status;
    }
    case DWG_TYPE_MTEXT: {
        Dwg_Entity_MTEXT *text = object->tio.entity->tio.MTEXT;
        int decoded_text_owned = 0;
        char *decoded_text = decode_dwg_text(
            dwg, text->text, &decoded_text_owned);
        if (decoded_text == NULL) {
            return LITECAD_STATUS_OK;
        }
        LiteCADStatus status = emit_text(
            callbacks,
            context,
            in_definition,
            transform,
            text->ins_pt.x,
            text->ins_pt.y,
            text->text_height,
            atan2(text->x_axis_dir.y, text->x_axis_dir.x),
            1.0,
            layer_id,
            LITECAD_TEXT_KIND_MTEXT,
            0,
            0,
            (uint8_t)text->attachment,
            decoded_text);
        if (decoded_text_owned) {
            free(decoded_text);
        }
        return status;
    }
    case DWG_TYPE_CIRCLE: {
        Dwg_Entity_CIRCLE *circle = object->tio.entity->tio.CIRCLE;
        return emit_arc(
            callbacks,
            context,
            in_definition,
            transform,
            circle->center.x,
            circle->center.y,
            circle->radius,
            circle->radius,
            0.0,
            0.0,
            2.0 * M_PI,
            layer_id);
    }
    case DWG_TYPE_ARC: {
        Dwg_Entity_ARC *arc = object->tio.entity->tio.ARC;
        double start = arc->start_angle;
        double end = arc->end_angle;
        if (end <= start) {
            end += 2.0 * M_PI;
        }
        return emit_arc(
            callbacks,
            context,
            in_definition,
            transform,
            arc->center.x,
            arc->center.y,
            arc->radius,
            arc->radius,
            0.0,
            start,
            end,
            layer_id);
    }
    case DWG_TYPE_ELLIPSE: {
        Dwg_Entity_ELLIPSE *ellipse = object->tio.entity->tio.ELLIPSE;
        double ratio = ellipse->axis_ratio;
        double start = ellipse->start_angle;
        double end = ellipse->end_angle;
        if (end <= start) {
            end += 2.0 * M_PI;
        }
        return emit_arc(
            callbacks,
            context,
            in_definition,
            transform,
            ellipse->center.x,
            ellipse->center.y,
            hypot(ellipse->sm_axis.x, ellipse->sm_axis.y),
            hypot(ellipse->sm_axis.x, ellipse->sm_axis.y) * ratio,
            atan2(ellipse->sm_axis.y, ellipse->sm_axis.x),
            start,
            end,
            layer_id);
    }
    case DWG_TYPE_SPLINE: {
        Dwg_Entity_SPLINE *spline = object->tio.entity->tio.SPLINE;
        BITCODE_BS fit_count = spline->num_fit_pts;
        BITCODE_3DPOINT *fit_points = spline->fit_pts;
        if (fit_count > 1 && fit_points != NULL) {
            BITCODE_BS index;
            for (index = 1; index < fit_count; index++) {
                LiteCADStatus status = emit_line_doubles(
                    callbacks,
                    context,
                    in_definition,
                    transform,
                    fit_points[index - 1].x,
                    fit_points[index - 1].y,
                    fit_points[index].x,
                    fit_points[index].y,
                    layer_id);
                if (status != LITECAD_STATUS_OK) {
                    return status;
                }
            }
            return LITECAD_STATUS_OK;
        }
        {
            BITCODE_BL count = spline->num_ctrl_pts;
            Dwg_SPLINE_control_point *control_points = spline->ctrl_pts;
            BITCODE_BL index;
            if (control_points == NULL || count < 2) {
                return LITECAD_STATUS_OK;
            }
            for (index = 1; index < count; index++) {
                LiteCADStatus status = emit_line_doubles(
                    callbacks,
                    context,
                    in_definition,
                    transform,
                    control_points[index - 1].x,
                    control_points[index - 1].y,
                    control_points[index].x,
                    control_points[index].y,
                    layer_id);
                if (status != LITECAD_STATUS_OK) {
                    return status;
                }
            }
        }
        return LITECAD_STATUS_OK;
    }
    case DWG_TYPE_POINT: {
        Dwg_Entity_POINT *point = object->tio.entity->tio.POINT;
        const double size = 1.0;
        LiteCADStatus status = emit_line_doubles(
            callbacks, context, in_definition, transform,
            point->x - size, point->y, point->x + size, point->y, layer_id);
        if (status != LITECAD_STATUS_OK) return status;
        return emit_line_doubles(
            callbacks, context, in_definition, transform,
            point->x, point->y - size, point->x, point->y + size, layer_id);
    }
    case DWG_TYPE_SOLID: {
        Dwg_Entity_SOLID *solid = object->tio.entity->tio.SOLID;
        return emit_quad(
            callbacks, context, in_definition, transform,
            solid->corner1.x, solid->corner1.y,
            solid->corner2.x, solid->corner2.y,
            solid->corner3.x, solid->corner3.y,
            solid->corner4.x, solid->corner4.y,
            layer_id);
    }
    case DWG_TYPE_TRACE: {
        Dwg_Entity_TRACE *trace = object->tio.entity->tio.TRACE;
        return emit_quad(
            callbacks, context, in_definition, transform,
            trace->corner1.x, trace->corner1.y,
            trace->corner2.x, trace->corner2.y,
            trace->corner3.x, trace->corner3.y,
            trace->corner4.x, trace->corner4.y,
            layer_id);
    }
    case DWG_TYPE__3DFACE: {
        Dwg_Entity__3DFACE *face = object->tio.entity->tio._3DFACE;
        return emit_quad(
            callbacks, context, in_definition, transform,
            face->corner1.x, face->corner1.y,
            face->corner2.x, face->corner2.y,
            face->corner3.x, face->corner3.y,
            face->corner4.x, face->corner4.y,
            layer_id);
    }
    case DWG_TYPE_HATCH:
        return emit_hatch(
            dwg, object, callbacks, context, in_definition, transform);
    case DWG_TYPE_INSERT:
        return emit_insert(
            dwg, object, map, callbacks, context, 0,
            in_definition, transform, depth);
    case DWG_TYPE_MINSERT:
        return emit_insert(
            dwg, object, map, callbacks, context, 1,
            in_definition, transform, depth);
    default:
        if (is_dimension_type(object->fixedtype)) {
            return emit_dimension(
                dwg, object, callbacks, context, in_definition, transform);
        }
        return LITECAD_STATUS_OK;
    }
}

static int
collect_blocks(const Dwg_Data *dwg, LiteCADBlockMap *map)
{
    Dwg_Object_Ref *model_ref = dwg_model_space_ref((Dwg_Data *)dwg);
    Dwg_Object_Ref *paper_ref = dwg_paper_space_ref((Dwg_Data *)dwg);
    size_t capacity = dwg->block_control.num_entries;
    size_t index;

    map->entries = capacity == 0 ? NULL
        : (LiteCADBlockEntry *)calloc(capacity, sizeof(LiteCADBlockEntry));
    map->count = 0;
    if (capacity != 0 && map->entries == NULL) {
        return 0;
    }
    for (index = 0; index < capacity; index++) {
        Dwg_Object_Ref *ref = dwg->block_control.entries[index];
        Dwg_Object *object = ref == NULL ? NULL : ref->obj;
        if (object == NULL || object == (model_ref == NULL ? NULL : model_ref->obj)
            || object == (paper_ref == NULL ? NULL : paper_ref->obj)
            || object->fixedtype != DWG_TYPE_BLOCK_HEADER) {
            continue;
        }
        map->entries[map->count].object = object;
        map->entries[map->count].id = (uint32_t)map->count;
        map->count++;
    }
    return 1;
}

static LiteCADStatus
emit_block_definitions(
    const Dwg_Data *dwg,
    const LiteCADBlockMap *map,
    const LiteCADDocumentCallbacks *callbacks,
    void *context)
{
    size_t index;
    for (index = 0; index < map->count; index++) {
        Dwg_Object *object = map->entries[index].object;
        Dwg_Object_BLOCK_HEADER *header = object->tio.object->tio.BLOCK_HEADER;
        Dwg_Object *entity;
        if (header == NULL) {
            continue;
        }
        callbacks->begin_block_definition(
            context,
            map->entries[index].id,
            header->name == NULL ? "" : header->name);
        entity = get_first_owned_entity(object);
        while (entity != NULL) {
            LiteCADStatus status = emit_entity(
                dwg,
                entity,
                map,
                callbacks,
                context,
                1,
                &LITECAD_IDENTITY_TRANSFORM,
                0);
            if (status != LITECAD_STATUS_OK) {
                return status;
            }
            entity = get_next_owned_entity(object, entity);
        }
        callbacks->end_block_definition(context, map->entries[index].id);
    }
    return LITECAD_STATUS_OK;
}

LiteCADStatus
litecad_read_dwg_file(
    const char *path,
    const LiteCADDocumentCallbacks *callbacks,
    void *context,
    char *error_message,
    size_t error_capacity)
{
    Dwg_Data dwg;
    LiteCADBlockMap map = {0};
    Dwg_Object_Ref *model_ref;
    Dwg_Object *entity;
    int read_error;
    LiteCADStatus status = LITECAD_STATUS_OK;

    if (path == NULL || callbacks == NULL || callbacks->append_layer == NULL
        || callbacks->begin_block_definition == NULL
        || callbacks->append_line == NULL || callbacks->append_text == NULL
        || callbacks->end_block_definition == NULL
        || callbacks->append_root_line == NULL || callbacks->append_root_text == NULL
        || callbacks->append_block_instance == NULL) {
        set_error(error_message, error_capacity, "invalid LibreDWG bridge arguments");
        return LITECAD_STATUS_INVALID_ARGUMENT;
    }

    memset(&dwg, 0, sizeof(dwg));
    read_error = dwg_read_file(path, &dwg);
    /* LibreDWG may return non-critical entity warnings while still producing
     * a usable document. Only the critical bit range means no scene can be
     * constructed; preserve the supported entities from warning-level files. */
    if (read_error >= DWG_ERR_CRITICAL) {
        if (error_message != NULL && error_capacity > 0) {
            snprintf(
                error_message,
                error_capacity,
                "LibreDWG failed to read DWG (code %d)",
                read_error);
        }
        dwg_free(&dwg);
        return LITECAD_STATUS_PARSE_ERROR;
    }
    if (!collect_blocks(&dwg, &map)) {
        set_error(error_message, error_capacity, "unable to allocate block map");
        dwg_free(&dwg);
        return LITECAD_STATUS_PARSE_ERROR;
    }

    status = emit_layers(&dwg, callbacks, context);
    if (status != LITECAD_STATUS_OK) {
        free(map.entries);
        dwg_free(&dwg);
        return status;
    }

    /* Definitions must arrive before root INSERT events so the consumer can
     * resolve the compact definition id without copying block geometry. */
    status = emit_block_definitions(&dwg, &map, callbacks, context);
    model_ref = dwg_model_space_ref(&dwg);
    entity = status == LITECAD_STATUS_OK && model_ref != NULL
        ? get_first_owned_entity(model_ref->obj)
        : NULL;
    while (entity != NULL && status == LITECAD_STATUS_OK) {
        status = emit_entity(
            &dwg,
            entity,
            &map,
            callbacks,
            context,
            0,
            NULL,
            0);
        entity = get_next_owned_entity(model_ref->obj, entity);
    }
    if (status != LITECAD_STATUS_OK) {
        set_error(error_message, error_capacity, "LibreDWG entity conversion failed");
    }

    free(map.entries);
    dwg_free(&dwg);
    return status;
}

const char *
litecad_libredwg_version(void)
{
    return "0.14.8597";
}
