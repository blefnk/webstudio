import {
  IconButton,
  Button,
  Box,
  Label,
  TextArea,
  TextField,
  styled,
  Flex,
  InputErrorsTooltip,
  Tooltip,
} from "@webstudio-is/design-system";
import { useFetcher } from "@remix-run/react";
import { ChevronDoubleLeftIcon, TrashIcon } from "@webstudio-is/icons";
import { utils as projectUtils } from "@webstudio-is/project";
import type { ZodError } from "zod";
import { Header } from "../../lib/header";
import { useState, useCallback, ComponentProps } from "react";
import { type Page } from "@webstudio-is/project";
import { usePages } from "~/designer/shared/nano-states";
import { useDebounce, useUnmount } from "react-use";
import { useOnFetchEnd, usePersistentFetcher } from "~/shared/fetcher";
import {
  normalizeErrors,
  toastUnknownFieldErrors,
  useIds,
  useFetcherErrors,
} from "~/shared/form-utils";
import type {
  DeletePageData,
  EditPageData,
  CreatePageData,
} from "~/shared/pages";
import { restPagesPath } from "~/shared/router-utils";

const Group = styled(Flex, {
  marginBottom: "$3",
  gap: "$2",
  defaultVariants: { direction: "column" },
});

const fieldNames = ["name", "path", "title", "description"] as const;
type FieldName = typeof fieldNames[number];
type FormPage = Pick<Page, "name" | "path" | "title"> & {
  description: string;
};

const toFormPage = (page: Page): FormPage => {
  return {
    name: page.name,
    path: page.path,
    title: page.title,
    description: page.meta.description ?? "",
  };
};

const FormFields = ({
  disabled,
  values,
  onChange,
  fieldErrors,
}: {
  disabled?: boolean;
  values: FormPage;
  onChange: <Name extends FieldName>(event: {
    field: Name;
    value: FormPage[Name];
  }) => void;
  fieldErrors: ZodError["formErrors"]["fieldErrors"];
}) => {
  const fieldIds = useIds(fieldNames);

  return (
    <>
      <Group>
        <Label htmlFor={fieldIds.name}>Page Name</Label>
        <InputErrorsTooltip errors={fieldErrors.name}>
          <TextField
            state={fieldErrors.name && "invalid"}
            id={fieldIds.name}
            name="name"
            disabled={disabled}
            value={values?.name}
            onChange={(event) => {
              onChange({ field: "name", value: event.target.value });
            }}
          />
        </InputErrorsTooltip>
      </Group>
      <Group>
        <Label htmlFor={fieldIds.path}>Path</Label>
        <InputErrorsTooltip errors={fieldErrors.path}>
          <TextField
            state={fieldErrors.path && "invalid"}
            id={fieldIds.path}
            name="path"
            disabled={disabled}
            value={values?.path}
            onChange={(event) => {
              onChange({ field: "path", value: event.target.value });
            }}
          />
        </InputErrorsTooltip>
      </Group>
      <Group>
        <Label htmlFor={fieldIds.title}>Title</Label>
        <InputErrorsTooltip errors={fieldErrors.title}>
          <TextField
            state={fieldErrors.title && "invalid"}
            id={fieldIds.title}
            name="title"
            disabled={disabled}
            value={values?.title}
            onChange={(event) => {
              onChange({ field: "title", value: event.target.value });
            }}
          />
        </InputErrorsTooltip>
      </Group>
      <Group>
        <Label htmlFor={fieldIds.description}>Description</Label>
        <InputErrorsTooltip errors={fieldErrors.description}>
          <TextArea
            state={fieldErrors.description && "invalid"}
            id={fieldIds.description}
            name="description"
            disabled={disabled}
            value={values?.description}
            onChange={(event) => {
              onChange({ field: "description", value: event.target.value });
            }}
          />
        </InputErrorsTooltip>
      </Group>
    </>
  );
};

export const NewPageSettings = ({
  onClose,
  onSuccess,
  projectId,
}: {
  onClose?: () => void;
  onSuccess?: (page: Page) => void;
  projectId: string;
}) => {
  const fetcher = useFetcher<CreatePageData>();

  useOnFetchEnd(fetcher, (data) => {
    if (data.status === "ok") {
      onSuccess?.(data.page);
    }
  });

  const isSubmitting = fetcher.state !== "idle";

  const { fieldErrors, resetFieldError } = useFetcherErrors({
    fetcher,
    fieldNames,
  });

  const [values, setValues] = useState<FormPage>({
    name: "",
    path: "",
    title: "",
    description: "",
  });

  const handleSubmit = () => {
    fetcher.submit(values, {
      method: "put",
      action: restPagesPath({ projectId }),
    });
  };

  return (
    <NewPageSettingsView
      onSubmit={handleSubmit}
      onClose={onClose}
      isSubmitting={isSubmitting}
      fieldErrors={fieldErrors}
      disabled={isSubmitting}
      values={values}
      onChange={({ field, value }) => {
        resetFieldError(field);
        setValues((values) => ({ ...values, [field]: value }));
      }}
    />
  );
};

const NewPageSettingsView = ({
  onSubmit,
  isSubmitting,
  onClose,
  ...formFieldsProps
}: {
  onSubmit: () => void;
  isSubmitting: boolean;
  onClose?: () => void;
} & ComponentProps<typeof FormFields>) => {
  return (
    <>
      <Header
        title="New Page Settings"
        suffix={
          onClose && (
            <Tooltip content="Cancel" side="bottom" align="end">
              <IconButton size="2" onClick={onClose} aria-label="Cancel">
                <ChevronDoubleLeftIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <Box css={{ overflow: "auto", padding: "$2 $3" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <FormFields {...formFieldsProps} />
          <Group css={{ alignItems: "end" }}>
            <Button type="submit" variant="green" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </Group>
        </form>
      </Box>
    </>
  );
};

const toFormData = (page: Partial<FormPage> & { id: string }): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(page)) {
    // @todo: handle "meta"
    if (typeof value === "string") {
      formData.append(key, value);
    }
  }
  return formData;
};

export const PageSettings = ({
  onClose,
  onDelete,
  pageId,
  projectId,
}: {
  onClose?: () => void;
  onDelete?: () => void;
  pageId: string;
  projectId: string;
}) => {
  const submitPersistently = usePersistentFetcher();

  const fetcher = useFetcher<EditPageData>();

  const [pages] = usePages();
  const page = pages && projectUtils.pages.findById(pages, pageId);

  const [unsavedValues, setUnsavedValues] = useState<Partial<FormPage>>({});
  const [submittedValues, setSubmittedValues] = useState<Partial<FormPage>>({});

  const { fieldErrors, resetFieldError } = useFetcherErrors({
    fetcher,
    fieldNames,
  });

  const handleChange = useCallback(
    <Name extends FieldName>(event: { field: Name; value: FormPage[Name] }) => {
      resetFieldError(event.field);
      setUnsavedValues((values) => ({ ...values, [event.field]: event.value }));
    },
    [resetFieldError]
  );

  useDebounce(
    () => {
      if (Object.keys(unsavedValues).length === 0) {
        return;
      }

      // We're re-submitting the submittedValues because previous submit is going to be cancelled
      // (normally, submittedValues are empty at this point)
      const valuesToSubmit = { ...submittedValues, ...unsavedValues };

      fetcher.submit(toFormData({ id: pageId, ...valuesToSubmit }), {
        method: "post",
        action: restPagesPath({ projectId }),
      });

      setSubmittedValues(valuesToSubmit);
      setUnsavedValues({});
    },
    1000,
    [unsavedValues]
  );

  useUnmount(() => {
    if (Object.keys(unsavedValues).length === 0) {
      return;
    }
    // We use submitPersistently instead of fetcher.submit
    // because we don't want the request to be canceled when the component unmounts
    submitPersistently<EditPageData>(
      toFormData({ id: pageId, ...submittedValues, ...unsavedValues }),
      { method: "post", action: restPagesPath({ projectId }) },
      (data) => {
        if (data.status === "error") {
          toastUnknownFieldErrors(normalizeErrors(data.errors), []);
        }
      }
    );
  });

  useOnFetchEnd(fetcher, (data) => {
    if (data.status === "error") {
      setUnsavedValues({ ...submittedValues, ...unsavedValues });
    }
    setSubmittedValues({});
  });

  const hanldeDelete = () => {
    // We use submitPersistently instead of fetcher.submit
    // because we don't want the request to be canceled when the component unmounts
    submitPersistently<DeletePageData>(
      { id: pageId },
      { method: "delete", action: restPagesPath({ projectId }) },
      (data) => {
        if (data.status === "error") {
          toastUnknownFieldErrors(normalizeErrors(data.errors), []);
        }
      }
    );
    onDelete?.();
  };

  if (page === undefined) {
    return null;
  }

  return (
    <PageSettingsView
      isHomePage={pageId === pages?.homePage.id}
      onClose={onClose}
      onDelete={hanldeDelete}
      fieldErrors={fieldErrors}
      values={{ ...toFormPage(page), ...submittedValues, ...unsavedValues }}
      onChange={handleChange}
    />
  );
};

const PageSettingsView = ({
  isHomePage,
  onDelete,
  onClose,
  ...formFieldsProps
}: {
  isHomePage: boolean;
  onDelete: () => void;
  onClose?: () => void;
} & ComponentProps<typeof FormFields>) => {
  return (
    <>
      <Header
        title="Page Settings"
        suffix={
          <>
            {isHomePage === false && (
              <Tooltip content="Delete page" side="bottom">
                <IconButton
                  size="2"
                  onClick={onDelete}
                  aria-label="Delete page"
                >
                  <TrashIcon />
                </IconButton>
              </Tooltip>
            )}
            {onClose && (
              <Tooltip content="Close page settings" side="bottom" align="end">
                <IconButton
                  size="2"
                  onClick={onClose}
                  aria-label="Close page settings"
                >
                  <ChevronDoubleLeftIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        }
      />
      <Box css={{ overflow: "auto", padding: "$2 $3" }}>
        <FormFields {...formFieldsProps} />
      </Box>
    </>
  );
};