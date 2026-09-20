#include "LibreDWGBridge.h"

#include <stdio.h>
#include <stdlib.h>

typedef struct {
    size_t block_definitions;
    size_t definition_lines;
    size_t root_lines;
    size_t definition_text;
    size_t root_text;
    size_t block_instances;
    size_t active_definition_lines;
    char sample_text[256];
} SmokeContext;

static void
append_layer(void *context, const LiteCADLayer *layer)
{
    (void)context;
    (void)layer;
}

static void
begin_block(void *context, uint32_t definition_id, const char *name)
{
    SmokeContext *smoke = (SmokeContext *)context;
    (void)definition_id;
    (void)name;
    smoke->block_definitions++;
    smoke->active_definition_lines = 0;
}

static void
append_definition_line(void *context, const LiteCADLine *line)
{
    SmokeContext *smoke = (SmokeContext *)context;
    (void)line;
    smoke->definition_lines++;
    smoke->active_definition_lines++;
}

static void
append_definition_text(void *context, const LiteCADTextAnnotation *annotation)
{
    SmokeContext *smoke = (SmokeContext *)context;
    smoke->definition_text++;
    if (smoke->sample_text[0] == '\0' && annotation != NULL && annotation->text != NULL) {
        snprintf(smoke->sample_text, sizeof(smoke->sample_text), "%s", annotation->text);
    }
}

static void
end_block(void *context, uint32_t definition_id)
{
    (void)context;
    (void)definition_id;
}

static void
append_root_line(void *context, const LiteCADLine *line)
{
    SmokeContext *smoke = (SmokeContext *)context;
    (void)line;
    smoke->root_lines++;
}

static void
append_root_text(void *context, const LiteCADTextAnnotation *annotation)
{
    SmokeContext *smoke = (SmokeContext *)context;
    smoke->root_text++;
    if (smoke->sample_text[0] == '\0' && annotation != NULL && annotation->text != NULL) {
        snprintf(smoke->sample_text, sizeof(smoke->sample_text), "%s", annotation->text);
    }
}

static void
append_block_instance(
    void *context,
    uint32_t definition_id,
    float a,
    float b,
    float c,
    float d,
    float tx,
    float ty,
    uint16_t layer_id)
{
    SmokeContext *smoke = (SmokeContext *)context;
    (void)definition_id;
    (void)a;
    (void)b;
    (void)c;
    (void)d;
    (void)tx;
    (void)ty;
    (void)layer_id;
    smoke->block_instances++;
}

int
main(int argc, char **argv)
{
    SmokeContext smoke = {0};
    LiteCADDocumentCallbacks callbacks = {
        .append_layer = append_layer,
        .begin_block_definition = begin_block,
        .append_line = append_definition_line,
        .append_text = append_definition_text,
        .end_block_definition = end_block,
        .append_root_line = append_root_line,
        .append_root_text = append_root_text,
        .append_block_instance = append_block_instance
    };
    char error_message[512] = {0};
    LiteCADStatus status;

    if (argc != 2) {
        fprintf(stderr, "usage: bridge-smoke path/to/file.dwg\n");
        return EXIT_FAILURE;
    }

    status = litecad_read_dwg_file(
        argv[1], &callbacks, &smoke, error_message, sizeof(error_message));
    if (status != LITECAD_STATUS_OK) {
        fprintf(stderr, "bridge status %d: %s\n", status, error_message);
        return EXIT_FAILURE;
    }

    printf(
        "libredwg=%s block_definitions=%zu definition_lines=%zu "
        "root_lines=%zu definition_text=%zu root_text=%zu "
        "block_instances=%zu sample_text=%s\n",
        litecad_libredwg_version(),
        smoke.block_definitions,
        smoke.definition_lines,
        smoke.root_lines,
        smoke.definition_text,
        smoke.root_text,
        smoke.block_instances,
        smoke.sample_text[0] == '\0' ? "<none>" : smoke.sample_text);
    return EXIT_SUCCESS;
}
