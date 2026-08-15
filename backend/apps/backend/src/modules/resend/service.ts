import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  Logger,
  NotificationTypes,
} from "@medusajs/framework/types"
import {
  CreateEmailOptions,
  Resend,
} from "resend"
import {
  EmailTemplateName,
  TEMPLATES,
  renderSubject,
  renderTemplate,
} from "./templates"

type InjectedDependencies = {
  logger: Logger
}

type ResendNotificationProviderOptions = {
  api_key: string
  from: string
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"

  private resendClient: Resend
  private options: ResendNotificationProviderOptions
  private logger: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: ResendNotificationProviderOptions
  ) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: ResendNotificationProviderOptions) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      )
    }
  }

  getTemplate(template: EmailTemplateName, data: Record<string, unknown>): string {
    return renderTemplate(TEMPLATES[template], data)
  }

  getTemplateSubject(template: EmailTemplateName, data: Record<string, unknown>): string {
    return renderSubject(TEMPLATES[template], data)
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const template = TEMPLATES[notification.template as EmailTemplateName]

    if (!template) {
      this.logger.error(
        `Couldn't find an email template for ${notification.template}. The valid options are ${Object.keys(TEMPLATES).join(", ")}`
      )
      return {}
    }

    const data = notification.data ?? {}

    const emailOptions: CreateEmailOptions = {
      from: this.options.from,
      to: [notification.to],
      subject: this.getTemplateSubject(notification.template as EmailTemplateName, data),
      html: this.getTemplate(notification.template as EmailTemplateName, data),
    }

    const { data: email, error } = await this.resendClient.emails.send(emailOptions)

    if (error || !email) {
      if (error) {
        this.logger.error("Failed to send email with Resend", error)
      } else {
        this.logger.error("Failed to send email with Resend: unknown error")
      }
      return {}
    }

    return { id: email.id }
  }
}

export default ResendNotificationProviderService